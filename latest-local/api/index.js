'use strict';
// The local sandbox is not an authenticated clinical or telephone service.
module.exports = (_request,response) => response.status(410).json({error:'This sandbox is local-only.'});
