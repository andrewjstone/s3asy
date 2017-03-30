var knox = require('knox'),
    util = require('util'),
    async = require('async'),
    sax = require('sax');

var S3 = module.exports = function(config) {
  if (config.cache) {
    var Cache = require('cacheit');
    this.cache = new Cache();
  };
  var knox_conf = {
    key: config.key,
    secret: config.secret,
    bucket: config.bucket,
    endpoint: config.endpoint,
    region: config.region,
    style: config.style,
    port: config.port
  };
  this.client = knox.createClient(knox_conf);
};

S3.prototype.get = function(path, headers, callback) {
  var self = this;
  var cache = this.cache;

  if (typeof headers === 'function') {
    callback = headers; 
    headers = {};
  }

  var _get = function(path, headers) {
    self.client.get(path, headers).on('response', function(res) {

      if (res.statusCode === 304) {
        return cache.get(path, function(err, data) {
          if (err) return callback(err);
          if (!data) {

            // We need to bust the cache here. The data was cleared out of redis already,
            // but S3 think's it wasn't modified.
            return cache.delete(path+'-date', function(err) {
              if (err) return callback(err);
              delete headers['If-Modified-Since'];
              self.get(path, headers, callback);
            });
          }

          // return the cached data
          callback(null, data);
        });
      }

      var complete = false;
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        body += chunk;
      });
      res.on('end', function() {
        if (complete) return; // an error has occurred
        if (res.statusCode != 200) {
          return callback(new Error('ERROR: status code = '+res.statusCode+'. body = '+body));
        }
        async.series([
          function(cb) {
            if (cache) return cache.set(path+'-date', res.headers['date'], cb);
            cb();
          },
          function(cb) {
            if (cache) return cache.set(path, body, cb); 
            cb();
          }], function(err) {
            callback(err, body);
          });
        });
      res.on('error', function(err) {
        complete = true;
        callback('error', path, headers, err);
      });
    }).end();
  };

  if (cache) {
    return cache.get(path+'-date', function(err, date) {
      if (err) return callback(err);
      if (date) headers['If-Modified-Since'] = date;
      _get(path, headers);
    });
  }
  _get(path, headers);
};

S3.prototype.put = function(path, headers, data, callback) {
  var cache = this.cache;
  if (typeof headers === 'string') {
    callback = data;
    data = headers;
    headers = {};
  }
  this.client.put(path, headers).on('response', function(res) {
    if (res.statusCode != 200) {
      return callback(new Error('ERROR: status code = '+res.statusCode), res.body);
    }
    async.series([
        function(cb) {
            if (cache) return cache.set(path+'-date', res.headers['date'], cb);
            cb();
        },
        function(cb) {
            if (cache) return cache.set(path, data, cb); 
            cb();
        }], function(err) {
            callback(err, data);
        });
  }).end(data);
};

S3.prototype.delete = function(path, headers, callback) {
  if (typeof headers === 'function') {
    callback = headers;
    headers = {};
  }
  var cache = this.cache;
  this.client.del(path, headers).on('response', function(res) {
    if (res.statusCode != 200 && res.statusCode != 204) {
      return callback(new Error('ERROR: status code = '+res.statusCode), res.body);
    }
    async.series([
        function(cb) {
            if (cache) return cache.delete(path+'-date', cb);
            cb();
        },
        function(cb) {
            if (cache) return cache.delete(path, cb); 
            cb();
        }], function(err) {
            callback(err);
        });
  }).end();
};

S3.prototype.copy = function(dst_path, src_path, src_bucket, headers, callback) {
  if (typeof headers === 'function') {
    callback = headers;
    headers = {};
  }
  var src_header = '/'+src_bucket; 
  if (src_path.indexOf('/') === 0) {
    src_header += src_path;
  } else {
    src_header += '/' + src_path;
  }
  headers['x-amz-copy-source'] = src_header;
  this.put(dst_path, headers, '', callback);
};

S3.prototype.ls = function(path, callback) {
  this.get('/?prefix='+path, function(err, xml) {
    if (err) return callback(err);    
    var name;
    var paths = [];
    var parser = sax.parser(true);

    parser.onopentag = function(node) {
      name = node.name;
    };

    parser.ontext = function(text) {
      if (name == 'Key') paths.push(text);
    };
    
    parser.onend = function() {
      callback(null, paths);
    };
    
    parser.write(xml).close();
  });
};
