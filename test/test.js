var S3 = require('../index');
var tmp = require('tmp');
var s3rver = require('s3rver');
var assert = require('assert');
var mkdirp = require('mkdirp');
var path = require('path');

var config;
var tmpDir;
var s3rverInstance;

try {
	config = require(process.env.HOME+'/.s3asy_test_config');
} catch (e) {
	config = {
		key: '<api-key-here>',
		secret: '<secret-here>',
		endpoint: 'localhost',
		bucket: 's3asy-test',
		port: 4569,
		style: 'path',
		cache: true,
	};
}

var s3 = new S3(config);
s3.cache.default_ttl = 1;

var original = 'Hello World!';
var cacheForced = 'Hello New World!';

before(function(done) {
	tmpDir = tmp.dirSync();
	tmp.setGracefulCleanup();
	mkdirp.sync(path.join(tmpDir.name, config.bucket));
	s3rverInstance = new s3rver({
		hostname: 'localhost',
		port: 4569,
		silent: true,
		removeBucketsOnClose: true,
		directory: tmpDir.name
	}).run(function(err, host, port) {
		if(err) {
			return done(err);
		}
		done();
	});
});

describe('s3asy', function() {
  // Basic Tests
  it('can put a file', function(done) {
    s3.put('/test/s3asy', {
      'Content-Type': 'text/plain',
      'Content-Length': original.length
    }, original, function(err) {
      assert.ok(!err);
      done();
    });
  });

  it('can put a file without caching on put', function(done) {
    s3.put('/test/s3asy', {
      'Content-Type': 'text/plain',
      'Content-Length': original.length
    }, original, function(err) {
      assert.ok(!err);
      s3.cache.get('/test/s3asy', function(err, data) {
        assert.ok(!err);
        assert.deepEqual(data, undefined);
        done();
      });
    });
  });

  it('can put a file with caching on put (cacheOnPut)', function(done) {
		s3.cacheOnPut = true;
    s3.put('/test/s3asy', {
      'Content-Type': 'text/plain',
      'Content-Length': original.length
    }, original, function(err) {
			s3.cacheOnPut = false;
      assert.ok(!err);
      s3.cache.get('/test/s3asy', function(err, data) {
        assert.ok(!err);
        assert.equal(data, original);
        done();
      });
    });
  });

  it('can retrieve the same file', function(done) {
    s3.get('/test/s3asy', function(err, data) {
      assert.ok(!err);
      assert.equal(data, original);
      done();
    });
  });

  // Cache tests
  it('has the file cached', function(done) {
    s3.cache.get('/test/s3asy', function(err, data) {
      assert.ok(!err);
      assert.equal(data, original);
      done();
    });
  });

  it('can retrieve the cached file', function(done) {
    s3.get('/test/s3asy', function(err, data) {
      assert.ok(!err);
      assert.equal(data, original);
      done();
    });
  });

  it('does not have the file cached after 2 seconds', function(done) {
    this.timeout(5000);
    setTimeout(function() {
      s3.cache.get('/test/s3asy', function(err, data) {
        assert.ok(!err);
        assert.deepEqual(data, undefined);
        done();
      });
    }, 2000);
  });

    
  it('can save and retrieve the original content again', function(done) {
    // Reset the default ttl to 10 sec
    s3.cache.default_ttl = 10;

    s3.put('/test/s3asy', {
      'Content-Type': 'text/plain',
      'Content-Length': original.length
    }, original, function(err) {
      assert.ok(!err);
      s3.get('/test/s3asy', function(err, data) {
        assert.ok(!err);
        assert.equal(data, original);
        done();
      });
    });
  });

  it('can successfully bust the cache', function(done) {
    s3.cache.delete('/test/s3asy', function(err) {
      assert.ok(!err);

      // Data is no longer in cache
      s3.cache.get('/test/s3asy', function(err, data) {
        assert.ok(!err);
        assert.deepEqual(data, undefined);

        // Last modified date is still in the cache
        s3.cache.get('/test/s3asy-date', function(err, data) {
          assert.ok(!err);
          assert.ok(data);

          // Ensure the cache was busted by getting data back from S3 and not 
          // undefined from the cache
          s3.get('/test/s3asy', function(err, data) {
            assert.ok(!err);
            assert.deepEqual(data, original);
            done();
          });
        });
      });
    });
  });

	// Here follow new tests for the preferCache options
  it('can prefer cache/stale data', function(done) {
    // Reset the default ttl to 10 sec
    s3.cache.default_ttl = 10;
		s3.preferCache = true;

    s3.put('/test/s3asy', {
      'Content-Type': 'text/plain',
      'Content-Length': original.length
    }, original, function(err) {
      assert.ok(!err);
			s3.cache.set('/test/s3asy', cacheForced, function(err) {
        assert.ok(!err);
				s3.get('/test/s3asy', function(err, data) {
					assert.ok(!err);
					assert.equal(data, cacheForced);
					done();
				});
			});
    });
  });

});

after(function(done) {
	if(s3rverInstance) return s3rverInstance.close(done);
	done();
});

