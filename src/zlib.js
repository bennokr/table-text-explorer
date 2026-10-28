// statfmt imports Node zlib eagerly; adapt its two functions for browser builds.
export { unzlibSync as inflateSync, zlibSync as deflateSync } from 'fflate';
