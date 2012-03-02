var knox = require('knox'),
    util = require('util'),
    async = require('async');

var S3 = module.exports = function(config) {
  if (config.cache) {
    var Cache = require('cacheit');
    this.cache = new Cache();
  };
  var knox_conf = {
    key: config.key,
    secret: config.secret,
    bucket: config.bucket
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

  var _get = function() {
    self.client.get(path, headers).on('response', function(res) {
      if (res.statusCode === 304) {
        return cache.get(path, callback);
      }
      if (res.statusCode != 200) {
        return callback(new Error('ERROR: status code = '+res.statusCode));
      }

      var complete = false;
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        body += chunk;
      });
      res.on('end', function() {
        if (complete) return; // an error has occurred
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
      _get();
    });
  }
  _get();
};

S3.prototype.put = function(path, headers, data, callback) {
  if (typeof headers === 'string') {
    callback = data;
    data = headers;
    headers = {};
  }
  this.client.put(path, headers).on('response', function(res) {
    if (res.statusCode != 200) {
      return callback(new Error('ERROR: status code = '+res.statusCode), res.body);
    }
    callback();
  }).end(data);
};

S3.prototype.delete = function(path, headers, callback) {
  if (typeof headers === 'function') {
    callback = headers;
    headers = {};
  }
  this.client.delete(path, headers).on('response', function(res) {
    if (res.statusCode != 200) {
      return callback(new Error('ERROR: status code = '+res.statusCode), res.body);
    }
    callback();
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
