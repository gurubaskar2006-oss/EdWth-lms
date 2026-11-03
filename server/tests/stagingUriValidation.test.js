/**
 * Lumina LMS — Staging MongoDB URI Validation Test Suite
 * 6th Civilians Corporation
 *
 * Strictly tests structured URI validation logic in memory.
 * Pure unit tests: NEVER connects to any database or network socket.
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateStagingMongoUri,
  validateStagingEnvironmentConfig
} from '../utils/stagingUriValidator.js';

describe('Lumina LMS — Staging MongoDB URI Structured Validation', () => {
  describe('1. Accepted Local Staging URIs', () => {
    it('accepts exact 127.0.0.1 with port 27018 and replicaSet option', () => {
      const uri = 'mongodb://127.0.0.1:27018/lumina_staging?replicaSet=rs0';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(true);
      expect(result.hosts).toEqual(['127.0.0.1:27018']);
      expect(result.database).toBe('lumina_staging');
    });

    it('accepts exact localhost with port 27018', () => {
      const uri = 'mongodb://localhost:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(true);
      expect(result.hosts).toEqual(['localhost:27018']);
      expect(result.database).toBe('lumina_staging');
    });

    it('accepts valid credentials on 127.0.0.1:27018', () => {
      const uri = 'mongodb://stagingOp:secureStagingPass@127.0.0.1:27018/lumina_staging?authSource=admin';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(true);
      expect(result.hosts).toEqual(['127.0.0.1:27018']);
      expect(result.database).toBe('lumina_staging');
    });

    it('accepts multi-host local replica set on port 27018', () => {
      const uri = 'mongodb://127.0.0.1:27018,localhost:27018/lumina_staging?replicaSet=rs0';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(true);
      expect(result.hosts).toEqual(['127.0.0.1:27018', 'localhost:27018']);
    });

    it('accepts URI without database name or trailing slash', () => {
      const uri = 'mongodb://127.0.0.1:27018';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(true);
      expect(result.hosts).toEqual(['127.0.0.1:27018']);
      expect(result.database).toBeUndefined();
    });
  });

  describe('2. Rejected Production & Remote Database URIs', () => {
    it('rejects MongoDB Atlas SRV URI', () => {
      const uri = 'mongodb+srv://admin:pass@cluster0.tvhnpjq.mongodb.net/lumina_production?retryWrites=true';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Atlas SRV protocol/i);
    });

    it('rejects any host on mongodb.net domain', () => {
      const uri = 'mongodb://cluster0.tvhnpjq.mongodb.net:27018/lumina_production';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Forbidden host/i);
    });

    it('rejects remote private LAN IPs', () => {
      const uri = 'mongodb://192.168.1.55:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Forbidden host "192.168.1.55"/i);
    });

    it('rejects public internet IPs', () => {
      const uri = 'mongodb://54.210.10.20:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Forbidden host "54.210.10.20"/i);
    });

    it('rejects 0.0.0.0 (all interfaces)', () => {
      const uri = 'mongodb://0.0.0.0:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Forbidden host "0.0.0.0"/i);
    });
  });

  describe('3. Rejected Subdomain Spoofing & Host Tampering', () => {
    it('rejects 127.0.0.1 prefix spoofing (127.0.0.1.attacker.example)', () => {
      const uri = 'mongodb://127.0.0.1.attacker.example:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Forbidden host "127.0.0.1.attacker.example"/i);
    });

    it('rejects localhost prefix spoofing (localhost.attacker.example)', () => {
      const uri = 'mongodb://localhost.attacker.example:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Forbidden host "localhost.attacker.example"/i);
    });

    it('rejects attacker domain with localhost in pathname', () => {
      const uri = 'mongodb://evil-server.org:27018/localhost';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Forbidden host "evil-server.org"/i);
    });

    it('rejects mixed valid and invalid hosts in replica set', () => {
      const uri = 'mongodb://127.0.0.1:27018,remote-host.com:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Forbidden host "remote-host.com"/i);
    });
  });

  describe('4. Port Validation & Bounds Checking', () => {
    it('rejects wrong port 27017 (standard MongoDB dev port)', () => {
      const uri = 'mongodb://127.0.0.1:27017/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Forbidden port "27017"/i);
    });

    it('rejects missing explicit port', () => {
      const uri = 'mongodb://127.0.0.1/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/missing an explicit port/i);
    });

    it('rejects empty port after colon', () => {
      const uri = 'mongodb://127.0.0.1:/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Malformed port/i);
    });

    it('rejects non-numeric port', () => {
      const uri = 'mongodb://127.0.0.1:abc/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Malformed port "abc"/i);
    });

    it('rejects out-of-range port: 0', () => {
      const uri = 'mongodb://127.0.0.1:0/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/out of valid range/i);
    });

    it('rejects out-of-range port: 65536', () => {
      const uri = 'mongodb://127.0.0.1:65536/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/out of valid range/i);
    });

    it('rejects port with leading zeros (e.g. 027018)', () => {
      const uri = 'mongodb://127.0.0.1:027018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/leading zeros/i);
    });

    it('validates invalid expectedPort configuration argument', () => {
      const uri = 'mongodb://127.0.0.1:27018/lumina_staging';
      expect(validateStagingMongoUri(uri, 0).valid).toBe(false);
      expect(validateStagingMongoUri(uri, 70000).valid).toBe(false);
      expect(validateStagingMongoUri(uri, 'invalid').valid).toBe(false);
    });
  });

  describe('5. Safe IPv6 Explicit Rejection', () => {
    it('explicitly rejects bracketed IPv6 loopback [::1]:27018', () => {
      const uri = 'mongodb://[::1]:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/IPv6 addresses/i);
      expect(result.reason).toMatch(/not permitted in staging/i);
    });

    it('explicitly rejects unbracketed IPv6 ::1:27018', () => {
      const uri = 'mongodb://::1:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/IPv6 addresses/i);
    });

    it('explicitly rejects link-local IPv6 [fe80::1]:27018', () => {
      const uri = 'mongodb://[fe80::1]:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/IPv6 addresses/i);
    });
  });

  describe('6. Credentials and Injection Defense', () => {
    it('rejects credentials with multiple unencoded "@" characters', () => {
      const uri = 'mongodb://user:pass@evil@127.0.0.1:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/multiple "@" characters/i);
    });

    it('rejects empty credentials preceding "@"', () => {
      const uri = 'mongodb://@127.0.0.1:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/empty credentials preceding "@"/i);
    });

    it('rejects credentials with empty username (starting with colon)', () => {
      const uri = 'mongodb://:password@127.0.0.1:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/username cannot be empty/i);
    });

    it('rejects credentials with whitespace', () => {
      const uri = 'mongodb://user name:pass@127.0.0.1:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/whitespace and control characters are prohibited/i);
    });

    it('rejects backslash injection in connection string', () => {
      const uri = 'mongodb://127.0.0.1:27018\\evil.com/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/backslashes.*prohibited/i);
    });

    it('rejects nested protocols (e.g. mongodb://http://127.0.0.1:27018)', () => {
      const uri = 'mongodb://http://127.0.0.1:27018/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/nested protocols or schemes/i);
    });

    it('rejects database paths containing additional slashes', () => {
      const uri = 'mongodb://127.0.0.1:27018/lumina_staging/extra_path';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/path slashes inside database name/i);
    });

    it('rejects empty host entry in comma-separated list', () => {
      const uri = 'mongodb://127.0.0.1:27018,/lumina_staging';
      const result = validateStagingMongoUri(uri, 27018);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Empty host entry/i);
    });
  });

  describe('7. Malformed Inputs & Non-string Handling', () => {
    it('rejects HTTP/HTTPS protocols', () => {
      expect(validateStagingMongoUri('http://127.0.0.1:27018', 27018).valid).toBe(false);
      expect(validateStagingMongoUri('https://127.0.0.1:27018', 27018).valid).toBe(false);
    });

    it('rejects non-string and empty inputs', () => {
      expect(validateStagingMongoUri('', 27018).valid).toBe(false);
      expect(validateStagingMongoUri('   ', 27018).valid).toBe(false);
      expect(validateStagingMongoUri(null, 27018).valid).toBe(false);
      expect(validateStagingMongoUri(undefined, 27018).valid).toBe(false);
      expect(validateStagingMongoUri(12345, 27018).valid).toBe(false);
      expect(validateStagingMongoUri({}, 27018).valid).toBe(false);
    });
  });

  describe('8. Staging Launcher Environment Validation (validateStagingEnvironmentConfig)', () => {
    const validConfig = {
      NODE_ENV: 'staging',
      PORT: '5001',
      MONGO_URI: 'mongodb://127.0.0.1:27018/lumina_staging?replicaSet=rs0',
      JWT_SECRET: 'staging-secret-key-32-chars-lumina-staging'
    };

    it('accepts valid isolated staging environment configuration', () => {
      const result = validateStagingEnvironmentConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.port).toBe('5001');
      expect(result.env).toBe('staging');
      expect(result.hosts).toEqual(['127.0.0.1:27018']);
      expect(result.database).toBe('lumina_staging');
    });

    it('refuses to run when NODE_ENV is production', () => {
      const result = validateStagingEnvironmentConfig({
        ...validConfig,
        NODE_ENV: 'production'
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/NODE_ENV must be strictly "staging"/i);
    });

    it('refuses to run when NODE_ENV is development', () => {
      const result = validateStagingEnvironmentConfig({
        ...validConfig,
        NODE_ENV: 'development'
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/NODE_ENV must be strictly "staging"/i);
    });

    it('refuses to run when PORT is 5000 (production/dev port collision prevention)', () => {
      const result = validateStagingEnvironmentConfig({
        ...validConfig,
        PORT: '5000'
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/PORT must be strictly "5001"/i);
    });

    it('refuses to run when MONGO_URI is Atlas SRV', () => {
      const result = validateStagingEnvironmentConfig({
        ...validConfig,
        MONGO_URI: 'mongodb+srv://user:pass@cluster0.mongodb.net/production'
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Atlas SRV protocol.*strictly prohibited/i);
    });

    it('refuses to run when MONGO_URI is on default MongoDB port 27017', () => {
      const result = validateStagingEnvironmentConfig({
        ...validConfig,
        MONGO_URI: 'mongodb://127.0.0.1:27017/lumina_staging'
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Forbidden port "27017"/i);
    });

    it('refuses to run when MONGO_URI is remote host', () => {
      const result = validateStagingEnvironmentConfig({
        ...validConfig,
        MONGO_URI: 'mongodb://remote-db.example.com:27018/lumina_staging'
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Forbidden host/i);
    });

    it('refuses to run when required variable is missing (JWT_SECRET)', () => {
      const invalid = { ...validConfig };
      delete invalid.JWT_SECRET;
      const result = validateStagingEnvironmentConfig(invalid);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Required staging variable "JWT_SECRET" is missing/i);
    });
  });
});
