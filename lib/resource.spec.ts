import { expect } from 'chai';
import sinon from 'ts-sinon';
import { Resource, IResource } from './resource';
import { FakeHttp } from './test/fake-http';
import { FakeStorage } from './test/fake-storage';
import { Hal } from './hal';
import { skip } from 'rxjs/operators';

describe('Resource', () => {
    describe('#constructor', () => {
        it('should set a valid alias', () => {
            const res = new Resource('/resource');
            expect(res.alias).to.be.equal('/resource');
        });

        it('should emit data on on alias data changes', (done) => {
            Hal.init(
                {
                    http: new FakeHttp,
                    storage: new FakeStorage
                }
            );

            const res = new Resource('/resource');
            const newData: IResource = {_links: {self: {href: '/resource'}}};

            res.data$.first().toPromise().then(data => {
                expect(data).to.be.eqls(newData);
                done();
            });

            Hal.setItem('/resource', newData);

            Hal.clear();
        });

        it('should set data from cache if origin exists', (done) => {
            const storage = new FakeStorage;

            storage.setItem('origins', JSON.stringify({
                '/resource': {_links: {self: {href: '/resource'}}}
            }));

            storage.setItem('aliases', JSON.stringify({
                '/resource_orig': '/resource',
                '/resource': '/resource'
            }));


            Hal.init(
                {
                    http: new FakeHttp,
                    storage: storage
                }
            );

            const res = new Resource('/resource');

            res.data$.first().toPromise().then(data => {
                expect(data).to.be.eqls({_links: {self: {href: '/resource'}}});
                done();
            });

            Hal.clear();
        });
    });

    describe('#resolveEmbeddedName', () => {
        it('should return a valid string', () => {
            const res = new Resource('/resource');
            expect(res.resolveEmbeddedName('embedded')).to.be.equal('/resource@embedded');
        });
    });

    describe('#resolveLinkName', () => {
        it('should return a valid string', () => {
            const res = new Resource('/resource');
            expect(res.resolveLinkName('link')).to.be.equal('/resource#link');
        });
    });

    describe('#getLink', () => {
        it('should return valid string', () => {
            const data: IResource = {_links: {self: {href: '/resource'}}};
            const res = Resource.fromData(data);
            expect(res.getLink('self')).to.be.equal('/resource');
        });

        it('should throw an exception if data is empty', () => {
            const res = new Resource('/resource');
            expect(() => {
                res.getLink('other');
            }).to.throw(Error, "Link 'other' not found.");
        });
    });

    describe('#getEmbedded', () => {
        it('should return valid value', () => {
            const data: IResource = {
                _links: {self: {href: '/resource'}},
                _embedded: {
                    'some_data': {
                        foo: 'bar'
                    }
                }
            };
            const res = Resource.fromData(data);
            expect(res.getEmbedded('some_data')).to.be.eqls({
                foo: 'bar'
            });
        });

        it('should return default value if data is empty', () => {
            const data: IResource = {
                _links: {self: {href: '/resource'}},
                _embedded: {
                    'some_data': {
                        foo: 'bar'
                    }
                }
            };
            const res = Resource.fromData(data);
            expect(res.getEmbedded('missing', 'default')).to.be.equal('default');
        });
    });

});

