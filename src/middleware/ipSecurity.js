const { promisify } = require('util');
const dns = require('dns');
const auditLogService = require('../services/auditLogService');

/**
 * IP Security Middleware
 * Handles IP whitelisting, blacklisting, and geoblocking
 */
class IPSecurityMiddleware {
  constructor() {
    // Load configuration from environment
    this.whitelist = this.parseIPList(process.env.IP_WHITELIST);
    this.blacklist = this.parseIPList(process.env.IP_BLACKLIST);
    this.allowedCountries = this.parseCountryList(process.env.ALLOWED_COUNTRIES);
    this.blockedCountries = this.parseCountryList(process.env.BLOCKED_COUNTRIES);
    
    // Rate limiting by country/region
    this.countryRateLimits = this.parseCountryRateLimits(process.env.COUNTRY_RATE_LIMITS);
    
    // Private IP ranges (RFC 1918, RFC 4193, etc.)
    this.privateRanges = [
      { start: '10.0.0.0', end: '10.255.255.255' },
      { start: '172.16.0.0', end: '172.31.255.255' },
      { start: '192.168.0.0', end: '192.168.255.255' },
      { start: '127.0.0.0', end: '127.255.255.255' },
      { start: '169.254.0.0', end: '169.254.255.255' },
      { start: 'fc00::', end: 'fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff' },
      { start: 'fe80::', end: 'febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff' }
    ];

    // Known malicious IP ranges (basic examples - in production use threat intelligence feeds)
    this.maliciousRanges = [
      // Add known botnet/malware C&C IP ranges
      // These should be updated from threat intelligence feeds
    ];

    this.dnsLookup = promisify(dns.reverse);
  }

  /**
   * Parse IP list from environment variable
   */
  parseIPList(ipListStr) {
    if (!ipListStr) return [];
    
    return ipListStr.split(',')
      .map(ip => ip.trim())
      .filter(ip => ip.length > 0)
      .map(ip => {
        // Support CIDR notation
        if (ip.includes('/')) {
          return this.parseCIDR(ip);
        }
        return { ip, type: 'single' };
      });
  }

  /**
   * Parse CIDR notation into range
   */
  parseCIDR(cidr) {
    const [ip, prefixLength] = cidr.split('/');
    const prefix = parseInt(prefixLength);
    
    return {
      ip,
      prefix,
      type: 'cidr'
    };
  }

  /**
   * Parse country list from environment variable
   */
  parseCountryList(countryListStr) {
    if (!countryListStr) return [];
    
    return countryListStr.split(',')
      .map(country => country.trim().toUpperCase())
      .filter(country => country.length === 2); // ISO 3166-1 alpha-2
  }

  /**
   * Parse country-specific rate limits
   */
  parseCountryRateLimits(rateLimitsStr) {
    if (!rateLimitsStr) return {};
    
    const limits = {};
    rateLimitsStr.split(',').forEach(limit => {
      const [country, rate] = limit.split(':');
      if (country && rate) {
        limits[country.trim().toUpperCase()] = parseInt(rate);
      }
    });
    
    return limits;
  }

  /**
   * Check if IP is in private range
   */
  isPrivateIP(ip) {
    return this.privateRanges.some(range => this.isIPInRange(ip, range));
  }

  /**
   * Check if IP is in specific range
   */
  isIPInRange(ip, range) {
    // Simple IPv4 range check (enhance for IPv6 if needed)
    if (ip.includes(':')) {
      // IPv6 - simplified check
      return ip.startsWith(range.start.split('::')[0]);
    }
    
    const ipNum = this.ipToNumber(ip);
    const startNum = this.ipToNumber(range.start);
    const endNum = this.ipToNumber(range.end);
    
    return ipNum >= startNum && ipNum <= endNum;
  }

  /**
   * Convert IP address to number for comparison
   */
  ipToNumber(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }

  /**
   * Check if IP matches CIDR
   */
  isIPInCIDR(ip, cidr) {
    const ipNum = this.ipToNumber(ip);
    const networkNum = this.ipToNumber(cidr.ip);
    const mask = (-1 << (32 - cidr.prefix)) >>> 0;
    
    return (ipNum & mask) === (networkNum & mask);
  }

  /**
   * Check if IP is whitelisted
   */
  isWhitelisted(ip) {
    return this.whitelist.some(entry => {
      if (entry.type === 'single') {
        return entry.ip === ip;
      } else if (entry.type === 'cidr') {
        return this.isIPInCIDR(ip, entry);
      }
      return false;
    });
  }

  /**
   * Check if IP is blacklisted
   */
  isBlacklisted(ip) {
    // Check explicit blacklist
    const explicitlyBlocked = this.blacklist.some(entry => {
      if (entry.type === 'single') {
        return entry.ip === ip;
      } else if (entry.type === 'cidr') {
        return this.isIPInCIDR(ip, entry);
      }
      return false;
    });

    if (explicitlyBlocked) return true;

    // Check malicious ranges
    return this.maliciousRanges.some(range => this.isIPInRange(ip, range));
  }

  /**
   * Get country code for IP (mock implementation - use MaxMind GeoIP2 in production)
   */
  async getCountryCode(ip) {
    // This is a mock implementation
    // In production, use a proper GeoIP service like MaxMind GeoIP2
    try {
      // Simple heuristic for demo purposes
      if (this.isPrivateIP(ip)) {
        return 'LOCAL';
      }

      // Mock mapping for demonstration
      const ipNum = this.ipToNumber(ip);
      if (ipNum >= this.ipToNumber('1.0.0.0') && ipNum <= this.ipToNumber('50.255.255.255')) {
        return 'US';
      } else if (ipNum >= this.ipToNumber('51.0.0.0') && ipNum <= this.ipToNumber('100.255.255.255')) {
        return 'EU';
      } else if (ipNum >= this.ipToNumber('101.0.0.0') && ipNum <= this.ipToNumber('150.255.255.255')) {
        return 'CN';
      }

      return 'UNKNOWN';
    } catch (error) {
      console.error('GeoIP lookup error:', error);
      return 'UNKNOWN';
    }
  }

  /**
   * Check if country is allowed
   */
  isCountryAllowed(countryCode) {
    // If allowed countries list is specified, only those are allowed
    if (this.allowedCountries.length > 0) {
      return this.allowedCountries.includes(countryCode) || countryCode === 'LOCAL';
    }

    // If blocked countries list is specified, block those
    if (this.blockedCountries.length > 0) {
      return !this.blockedCountries.includes(countryCode);
    }

    // Default: allow all countries
    return true;
  }

  /**
   * Perform reverse DNS lookup for additional security
   */
  async getHostname(ip) {
    try {
      const hostnames = await this.dnsLookup(ip);
      return hostnames?.[0] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check for suspicious patterns in hostname
   */
  isSuspiciousHostname(hostname) {
    if (!hostname) return false;

    const suspiciousPatterns = [
      /tor-exit/i,
      /proxy/i,
      /vpn/i,
      /bot/i,
      /crawler/i,
      /scanner/i,
      /hack/i,
      /exploit/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(hostname));
  }

  /**
   * Main IP security check middleware
   */
  createMiddleware() {
    return async (req, res, next) => {
      try {
        const clientIP = this.getClientIP(req);
        const userAgent = req.get('User-Agent') || '';
        
        // Always allow private IPs for internal network access
        if (this.isPrivateIP(clientIP)) {
          req.ipSecurity = {
            ip: clientIP,
            country: 'LOCAL',
            allowed: true,
            reason: 'private_ip'
          };
          return next();
        }

        // Check whitelist first (highest priority)
        if (this.isWhitelisted(clientIP)) {
          req.ipSecurity = {
            ip: clientIP,
            allowed: true,
            reason: 'whitelisted'
          };
          return next();
        }

        // Check blacklist
        if (this.isBlacklisted(clientIP)) {
          await this.logSecurityViolation(
            'IP_BLACKLISTED',
            { ip: clientIP, userAgent },
            req
          );
          return this.denyAccess(res, 'IP address is blocked');
        }

        // Get country information
        const countryCode = await this.getCountryCode(clientIP);
        
        // Check country restrictions
        if (!this.isCountryAllowed(countryCode)) {
          await this.logSecurityViolation(
            'COUNTRY_BLOCKED',
            { ip: clientIP, country: countryCode, userAgent },
            req
          );
          return this.denyAccess(res, 'Access from this location is not permitted');
        }

        // Perform additional security checks for external IPs
        const hostname = await this.getHostname(clientIP);
        if (hostname && this.isSuspiciousHostname(hostname)) {
          await this.logSecurityViolation(
            'SUSPICIOUS_HOSTNAME',
            { ip: clientIP, hostname, userAgent },
            req
          );
          // Don't block but increase monitoring
        }

        // Set IP security info for downstream middleware
        req.ipSecurity = {
          ip: clientIP,
          country: countryCode,
          hostname,
          allowed: true,
          reason: 'passed_checks'
        };

        next();
      } catch (error) {
        console.error('IP security middleware error:', error);
        // Fail securely - allow request but log the error
        req.ipSecurity = {
          ip: this.getClientIP(req),
          allowed: true,
          reason: 'security_check_failed',
          error: error.message
        };
        next();
      }
    };
  }

  /**
   * Get real client IP considering proxies
   */
  getClientIP(req) {
    // Check various headers that proxies might set
    const possibleHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'cf-connecting-ip', // Cloudflare
      'x-cluster-client-ip',
      'forwarded'
    ];

    for (const header of possibleHeaders) {
      const headerValue = req.get(header);
      if (headerValue) {
        // Handle comma-separated list (x-forwarded-for can have multiple IPs)
        const ips = headerValue.split(',').map(ip => ip.trim());
        const firstIP = ips[0];
        
        // Validate IP format
        if (this.isValidIP(firstIP)) {
          return firstIP;
        }
      }
    }

    // Fallback to socket remote address
    return req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.ip || 
           'unknown';
  }

  /**
   * Validate IP address format
   */
  isValidIP(ip) {
    // IPv4 pattern
    const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    // IPv6 pattern (simplified)
    const ipv6Pattern = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
  }

  /**
   * Log security violations
   */
  async logSecurityViolation(violationType, details, req) {
    await auditLogService.logSecurityViolation(
      violationType,
      {
        ...details,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      },
      req.user || null,
      details.ip
    );
  }

  /**
   * Deny access with security response
   */
  denyAccess(res, reason) {
    res.status(403).json({
      error: 'Access Denied',
      message: reason,
      code: 'IP_SECURITY_VIOLATION'
    });
  }

  /**
   * Create country-specific rate limiter
   */
  createCountryRateLimiter(countryCode) {
    const limit = this.countryRateLimits[countryCode];
    if (!limit) return null;

    // Return rate limit configuration for this country
    return {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: limit,
      message: {
        error: 'Rate limit exceeded for your location',
        retryAfter: '15 minutes'
      }
    };
  }

  /**
   * Get security status and statistics
   */
  getSecurityStatus() {
    return {
      whitelist_entries: this.whitelist.length,
      blacklist_entries: this.blacklist.length,
      allowed_countries: this.allowedCountries.length,
      blocked_countries: this.blockedCountries.length,
      country_rate_limits: Object.keys(this.countryRateLimits).length,
      private_ranges: this.privateRanges.length,
      malicious_ranges: this.maliciousRanges.length
    };
  }

  /**
   * Update IP lists dynamically (for admin interface)
   */
  updateIPList(type, operation, entry) {
    const list = type === 'whitelist' ? this.whitelist : this.blacklist;
    
    if (operation === 'add') {
      const parsedEntry = entry.includes('/') 
        ? this.parseCIDR(entry) 
        : { ip: entry, type: 'single' };
      list.push(parsedEntry);
    } else if (operation === 'remove') {
      const index = list.findIndex(item => item.ip === entry);
      if (index > -1) {
        list.splice(index, 1);
      }
    }

    return list.length;
  }
}

module.exports = new IPSecurityMiddleware();