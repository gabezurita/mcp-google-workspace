// Node >= 25 removed the long-deprecated buffer.SlowBuffer (DEP0030).
//
// buffer-equal-constant-time@1.0.1 reads SlowBuffer.prototype.equal at import
// time and throws before exporting anything. It reaches this process through:
//   googleapis -> google-auth-library -> jws -> jwa -> buffer-equal-constant-time
//
// The package is unmaintained (1.0.0 and 1.0.1 are the only releases ever
// published) and google-auth-library 11 still depends on the same chain, so
// there is no version to upgrade to.
//
// SlowBuffer is only touched by the package's optional install()/restore()
// monkey-patch helpers. jwa calls just bufferEqual(a, b), which never
// references it. Restoring a minimal stand-in is therefore enough to let the
// module load, and the constant-time comparison itself is unaffected.
//
// Deliberately a distinct function rather than Buffer itself, so a stray
// install() would patch this shim's prototype instead of Buffer.prototype.
//
// Preloaded via `node --require` from run.sh. Remove once the dependency
// chain drops buffer-equal-constant-time.

'use strict';

const buffer = require('buffer');

if (buffer.SlowBuffer === undefined) {
  buffer.SlowBuffer = function SlowBuffer(size) {
    return Buffer.allocUnsafeSlow(size);
  };
}
