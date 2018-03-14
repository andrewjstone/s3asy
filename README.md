# Introduction

s3asy ('S-Three-Zee') is a simple library for issuing GET, PUT, and DELETE requests against Amazon S3. It allows caching of files  in a local redis instance using the ```If-Modified-Since``` and ```Date``` headers as cache-control.

It achieves this simplicity by utilizing [knox](https://github.com/LearnBoost/knox) and [cacheit](https://github.com/andrewjstone/cacheit) under the hood.

#### Warning: Don't use this for large objects, as it obviously buffers them in memory. Also Redis cannot cash strings larger than 512 MB.

# Example

```javascript
var S3 = require('s3asy');
var s3 = new S3({
  key: '<api-key-here>',
  secret: '<secret-here>',
  bucket: 'bucket-name',
  cache: true
});

s3.get('/some/path', {'x-amz-acl': 'private'}, function(err, body) {
  console.log(body);
});

```

# Object creation
s3asy accepts all config options that knox accepts, and will use it verbatim.

# API

## s3.get(path, [headers], callback) 

## s3.put(path, headers, data, callback)
Requires ```Content-Type``` and ```Content-Length``` headers

## s3.delete(path, [headers], callback)

## s3.copy(dst_path, src_path, src_bucket, headers, callback)

 * dst_path - the destination filename
 * src_path - the source filename
 * src_bucket - the source bucket. The dst_bucket is the bucket passed to the constructor.

Requires ```Content-Type``` and ```Content-Length``` headers

## s3.ls(path, callback)

List files with a given prefix (path). Do NOT use a leading slash.

# Run Tests
Ensure you have mocha installed.

    npm install mocha

Add a config file for s3asy to use in ```~/.s3asy_test_config.js```. 

    module.exports = {
      key: '<api-key-here>',
      secret: '<secret-here>',
      bucket: 'bucket-name',
      cache: true
    };

Run tests

    cd test
    mocha test.js --reporter spec 
    
# Using s3asy with s3rver or other s3-compatible services
[s3rver](https://github.com/jamhall/s3rver) is a fake s3 server written in NodeJS. Please refer to the module's documentation on how to use s3rver.

## Example config
```javascript
var S3rver = require('s3rver');
var S3 = require('s3asy');

var s3rver = new S3rver({
    hostname: 'localhost',
    port: 10001,
    silent: true,
    directory: '/tmp/s3rver/' // Remember to create bucket folders here as well
}).run(function(err, host, port) {
    console.log('s3rver is running on:', host, ':', port);
});

var s3 = new S3({
  key: 'not applicable',
  secret: 'not applicable',
  bucket: 'bucket-name',
  endpoint: 'localhost',
  port: 10001,
  style: 'path',
  cache: true
});

s3.get('/some/path', {'x-amz-acl': 'private'}, function(err, body) {
  console.log(body);
});
```
