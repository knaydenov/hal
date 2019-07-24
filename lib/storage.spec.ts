
import {first} from 'rxjs/operators';
import { expect } from 'chai';
import sinon from 'ts-sinon';
import { HalStorage } from './storage';
import { FakeStorage } from './test/fake-storage';


describe('Storage', () => {
    describe('.constructor', () => {
        it('should restore aliases from cache', () => {
            const fakeStorage = new FakeStorage;
            fakeStorage.setItem('hal_aliases', JSON.stringify({
                '/me': '/me',
                '/self': '/me'
            }));
            
            const storage = new HalStorage({
                prefix: 'hal_',
                storage: fakeStorage
            });
            const aliases = storage.aliases;

            expect(aliases).to.be.eqls({
                '/me': '/me',
                '/self': '/me'
            });
        });

        it('should set data for origin when it changes', () => {
            const fakeStorage = new FakeStorage;

            fakeStorage.setItem('hal_origins', JSON.stringify({
                '/me':{
                    _links: {
                        self: {
                            href: '/me'
                        }
                    }
                }
            }));
            
            const storage = new HalStorage({
                prefix: 'hal_',
                storage: fakeStorage
            });
            const origins = storage.origins;

            expect(origins).to.be.eqls({
                '/me':{
                    _links: {
                        self: {
                            href: '/me'
                        }
                    }
                }
            });
        });

        it('should emit event for each alias of origin on data changes', (done) => {
            const fakeStorage = new FakeStorage;

            const storage = new HalStorage({
                prefix: 'hal_',
                storage: fakeStorage
            });

            const newMe = {
                name: 'new',
                _links: {
                    self: {
                        href: '/me'
                    }
                }
            };

            storage.attach('/me', '/me');
            storage.attach('/me', '/self');
            storage.attach('/me', '/other#res');

            const all = Promise.all([
                storage.aliasData$('/me').pipe(first()).toPromise(),
                storage.aliasData$('/self').pipe(first()).toPromise(),
                storage.aliasData$('/other#res').pipe(first()).toPromise(),
            ]);

            all.then(data => {
                expect(data[0]).to.be.eqls(newMe);
                expect(data[1]).to.be.eqls(newMe);
                expect(data[2]).to.be.eqls(newMe);
                done();
            })

            storage.setItem('/me', newMe);
        });
    });

    describe('#clear', () => {
        it('should return clear data correctly', () => {
            const fakeStorage = new FakeStorage;

            const storage = new HalStorage({
                prefix: 'hal_',
                storage: fakeStorage
            });
            
            storage.attach('/me', '/self');

            storage.setItem('/me', {
                name: 'new',
                _links: {
                    self: {
                        href: '/me'
                    }
                }
            })

            storage.clear();

            expect(storage.aliases).to.be.eqls({});
            expect(storage.origins).to.be.eqls({});
            expect(storage.storage.getItem(storage.aliasesKey)).to.be.null;
            expect(storage.storage.getItem(storage.originsKey)).to.be.null;


        });
    });

    describe('#getItem', () => {
        it('should return valid data', () => {
            const fakeStorage = new FakeStorage;

            const storage = new HalStorage({
                prefix: 'hal_',
                storage: fakeStorage
            });

            const data = {
                _links: {
                    self: {
                        href: '/me'
                    }
                }
            };

            storage.setItem('test', data);
            const gotData = storage.getItem('test');

            expect(gotData).to.be.eqls(data);

        });
    });

    describe('#removeItem', () => {
        it('should remove origin correctly', () => {
            const fakeStorage = new FakeStorage;

            const storage = new HalStorage({
                prefix: 'hal_',
                storage: fakeStorage
            });

            const data = {
                _links: {
                    self: {
                        href: '/me'
                    }
                }
            };

            storage.setItem('test', data);
            storage.removeItem('test');
            const gotData = storage.getItem('test');

            expect(gotData).to.be.null;
        });
    });

    describe('#setItem', () => {
        it('should emit event for origin on data changes', (done) => {
            const fakeStorage = new FakeStorage;

            const storage = new HalStorage({
                prefix: 'hal_',
                storage: fakeStorage
            });

            const newMe = {
                name: 'new',
                _links: {
                    self: {
                        href: '/me'
                    }
                }
            };

            storage.data$.pipe(first()).toPromise().then(data => {
                expect(data.key).to.be.equal('/me');
                expect(data.data).to.be.equal(newMe);
                done();
            });

            storage.setItem('/me', newMe);
            
        });

        it('should set valid alias for resource, each embedded resource and its aliases', () => {
            const fakeStorage = new FakeStorage;

            const storage = new HalStorage({
                prefix: 'hal_',
                storage: fakeStorage
            });

            const newMe = {
                _embedded: {
                    'xres': {
                        _links: {
                            self: {
                                href: '/res'
                            }
                        }
                    }
                },
                _links: {
                    self: {
                        href: '/me'
                    }
                }
            };

            storage.attach('/me', '/other');
            storage.setItem('/me', newMe);

            expect(storage.aliases).to.be.eqls({
                '/me': '/me',
                '/other': '/me',
                '/res': '/res',
                '/me@xres': '/res',
                '/other@xres': '/res'
            });
        });

        it('should set data for embedded resources', () => {
            const fakeStorage = new FakeStorage;

            const storage = new HalStorage({
                prefix: 'hal_',
                storage: fakeStorage
            });

            const newMe = {
                _embedded: {
                    'xres': {
                        _links: {
                            self: {
                                href: '/res'
                            }
                        }
                    }
                },
                _links: {
                    self: {
                        href: '/me'
                    }
                }
            };

            storage.setItem('/me', newMe);

            expect(storage.getItem('/res')).to.be.eqls({
                _links: {
                    self: {
                        href: '/res'
                    }
                }
            });
        });
    });

    describe('#attach', () => {
        it('should attach data correctly', () => {
            const fakeStorage = new FakeStorage;

            const storage = new HalStorage({
                prefix: 'hal_',
                storage: fakeStorage
            });

            storage.attach('/me', '/me');
            storage.attach('/me', '/other');

            expect(storage.getOrigin('/me')).to.be.equal('/me');
            expect(storage.getOrigin('/other')).to.be.equal('/me');
        });
    });

    describe('#detach', () => {
        it('should detach data correctly', () => {
            const fakeStorage = new FakeStorage;

            const storage = new HalStorage({
                prefix: 'hal_',
                storage: fakeStorage
            });

            storage.attach('/me', '/me');
            storage.attach('/me', '/other');

            expect(storage.getOrigin('/me')).to.be.equal('/me');
            expect(storage.getOrigin('/other')).to.be.equal('/me');

            storage.detach('/other');

            expect(storage.getOrigin('/other')).to.be.undefined;

        });
    });

    describe('#getAliases', () => {
        it('should return a valid list of strings', () => {
            const fakeStorage = new FakeStorage;

            const storage = new HalStorage({
                prefix: 'hal_',
                storage: fakeStorage
            });

            storage.attach('/me', '/me');
            storage.attach('/me', '/other');
            storage.attach('/me', '/go');

            expect(storage.getAliases('/me')).to.be.eqls(['/me', '/other', '/go']);
        });
    });
});

