const config={poweredByHeader:false,async headers(){return [{source:'/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'}]}];}};
export default config;
