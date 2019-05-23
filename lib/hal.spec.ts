import { expect, use } from 'chai';
import sinon from 'ts-sinon';  
import sinonChai from 'sinon-chai';
import { FakeHttp } from './test/fake-http';
import { FakeStorage } from './test/fake-storage';
import { Hal } from './hal';

import 'ts-sinon';
import { IResource, Resource } from './resource';

use(sinonChai);

describe('Hal', () => {
    describe('.follow', () => {
        it('should perform a valid GET query', () => {
            Hal.init(
                {
                    http: new FakeHttp,
                    storage: new FakeStorage
                }
            );
            const spy = sinon.spy(Hal.http, 'get');

            Hal.follow('/me');
            Hal.clear();

            expect(spy).to.have.been.calledOnceWith('/me');
        });

        it('should create valid aliases for self-link on successful request', async () => {
            Hal.init(
                {
                    http: new FakeHttp,
                    storage: new FakeStorage
                }
            );

            await Hal.follow('/self', null, 'alias');
            const aliases = Hal.aliases;
            Hal.clear();

            expect(aliases).to.be.eqls({
                'alias': '/me',
                '/me': '/me',
                '/self': '/me'
            });

        });

        it('should should set data for self-link on successful request', async () => {
            Hal.init(
                {
                    http: new FakeHttp,
                    storage: new FakeStorage
                }
            );

            await Hal.follow('/me');
            const me = Hal.getItem('/me');
            Hal.clear();

            expect(me).to.be.eqls({
                _links: {
                    self: {
                        href: '/me'
                    }
                }
            });
        });
       
    });

    describe('.resolveEmbeddedName', () => {
        it('should return a valid string', () => {
            expect(Hal.resolveEmbeddedName('resource', 'embedded')).to.be.equal('resource@embedded');
        });
    });

    describe('.resolveLinkName', () => {
        it('should return a valid string', () => {
            expect(Hal.resolveLinkName('resource', 'embedded')).to.be.equal('resource#embedded');
        });
    });

    describe('.getLink', () => {
        it('should return a valid string if the link exists', () => {
            const link = Hal.getLink({
                _links: {
                    self: {
                        href: 'url'
                    }
                }
            }, 'self');
            expect(link).to.be.equal('url');
        });

        it('should throw an exception if the link does not exist', () => {
            expect(() => {
                Hal.getLink({
                    _links: {
                        self: {
                            href: 'url'
                        }
                    }
                }, 'other');
            }).to.throw(Error, "Link 'other' not found.");
        });
    });

    describe('.getEmbedded', () => {
        it('should return default value if there is no embedded data', () => {
            expect(Hal.getEmbedded({
                _links: {
                    self: {
                        href: 'url'
                    }
                }
            }, 'embedded', 'default')).to.be.equal('default');
        });

        it('should return embedded data if it exists', () => {
            expect(Hal.getEmbedded({
                _embedded: {
                    embedded: 'value'
                },
                _links: {
                    self: {
                        href: 'url'
                    }
                }
            }, 'embedded')).to.be.equal('value');
        });

        it('should return default value if the embedded data does not exist', () => {
            expect(Hal.getEmbedded({
                _embedded: {
                    embedded: 'value'
                },
                _links: {
                    self: {
                        href: 'url'
                    }
                }
            }, 'other', 'default')).to.be.equal('default');
        });

    });

    describe('.resloveBaseUrl', () => {
        it('should return a valid base url', () => {
            expect(Hal.resloveBaseUrl('https://some-url.tld/path/to/resource?a=1&b=2&c[]=3#hello')).to.be.equal('https://some-url.tld/path/to/resource');
        });
    });

    describe('.implementsIResource', () => {
        it('should detect correctly', () => {
            const valid_1 = {
                _links: {
                    self: {
                        href: 'url'
                    }
                }
            }
            expect(Hal.implementsIResource(valid_1)).to.be.true;

            const invalid_1 = {

            };
            expect(Hal.implementsIResource(invalid_1)).to.be.false;

        });
    });

    describe('.removeSiblings', () => {
        it('should remove correct origins', () => {
            Hal.setItem('/data?page=1&limit=10', { _links: { self: { href: '/data?page=1&limit=10' }} });
            Hal.setItem('/data?page=2&limit=10', { _links: { self: { href: '/data?page=2&limit=10' }} });
            Hal.setItem('/data?page=3&limit=10', { _links: { self: { href: '/data?page=3&limit=10' }} });
            Hal.setItem('/data?page=4&limit=10', { _links: { self: { href: '/data?page=4&limit=10' }} });
            Hal.setItem('/data?page=5&limit=10', { _links: { self: { href: '/data?page=5&limit=10' }} });

            Hal.setItem('/user', { _links: { self: { href: '/user' }} });

            Hal.setItem('/other?page=1&limit=10', { _links: { self: { href: '/other?page=1&limit=10' }} });
            Hal.setItem('/other?page=2&limit=10', { _links: { self: { href: '/other?page=2&limit=10' }} });
            Hal.setItem('/other?page=3&limit=10', { _links: { self: { href: '/other?page=3&limit=10' }} });
            Hal.setItem('/other?page=4&limit=10', { _links: { self: { href: '/other?page=4&limit=10' }} });
            Hal.setItem('/other?page=5&limit=10', { _links: { self: { href: '/other?page=5&limit=10' }} });

            Hal.removeSiblings('/data');

            expect(Object.keys(Hal.origins).length).to.be.eq(6);
            expect(Hal.getItem('/other?page=1&limit=10')).to.be.eqls({ _links: { self: { href: '/other?page=1&limit=10' }} });
            expect(Hal.getItem('/user')).to.be.eqls({ _links: { self: { href: '/user' }} });
            expect(Hal.getItem('/data?page=1&limit=10')).to.be.null;
        });
    });

    describe('.hasCache', () => {
        it('should return valid values', () => {
            Hal.enableCache();
           
            Hal.setCache('some-alias', <Resource<any>>{});
            Hal.setCache('other-alias', <Resource<any>>{});

            expect(Hal.hasCache('some-alias')).to.be.true;
            expect(Hal.hasCache('other-alias')).to.be.true;
            expect(Hal.hasCache('wrong-alias')).to.be.false;

            Hal.clearCache();
            Hal.enableCache(false);
        });
    });

    describe('.getCache', () => {
        it('should return valid values', () => {
            Hal.enableCache();
            
            const res1 = <Resource<any>>{};
            const res2 = <Resource<any>>{};

            Hal.setCache('some-alias', res1);
            Hal.setCache('other-alias', res2);

            expect(Hal.getCache('some-alias')).to.be.equal(res1);
            expect(Hal.getCache('other-alias')).to.be.equal(res2);

            Hal.clearCache();
            Hal.enableCache(false);
        });

        it('should return null if item is not cached', () => {
            Hal.enableCache();
            
            const res1 = <Resource<any>>{};
            const res2 = <Resource<any>>{};

            Hal.setCache('some-alias', res1);
            Hal.setCache('other-alias', res2);

            expect(Hal.getCache('wrong-alias')).to.be.null;

            Hal.clearCache();
            Hal.enableCache(false);
        });
    });

    describe('.removeCache', () => {
        it('should remove items correctly', () => {
            Hal.enableCache();
            
            const res1 = <Resource<any>>{};
            const res2 = <Resource<any>>{};
            const res3 = <Resource<any>>{};

            Hal.setCache('some-alias', res1);
            Hal.setCache('other-alias', res2);
            Hal.setCache('another-alias', res3);

            
            
            expect(Hal.hasCache('another-alias')).to.be.true;
            Hal.removeCache('another-alias');
            expect(Hal.hasCache('another-alias')).to.be.false;

            expect(Hal.hasCache('other-alias')).to.be.true;
            Hal.removeCache('other-alias');
            expect(Hal.hasCache('other-alias')).to.be.false;

            expect(Hal.hasCache('some-alias')).to.be.true;
            Hal.removeCache('some-alias');
            expect(Hal.hasCache('some-alias')).to.be.false;

            Hal.clearCache();
            Hal.enableCache(false);
        });
    });
});

