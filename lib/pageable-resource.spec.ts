import { expect } from 'chai';
import sinon from 'ts-sinon';
import { PageableResource } from './pageable-resource';
import { Hal } from './hal';
import { FakeHttp, User } from './test/fake-http';
import { FakeStorage } from './test/fake-storage';
import { skip } from 'rxjs/operators/skip';


describe('PageableResource', () => {
    describe('.constructor', () => {
        it('should call #resolveOptions on data changes', async () => {
            Hal.init(
                {
                    http: new FakeHttp,
                    storage: new FakeStorage
                }
            );
            const users: PageableResource<User> = PageableResource
            .fromUrl<PageableResource<User>>('/users')
            .setItemConstructor(User);
            const spy = sinon.spy(users, 'resolveOptions');

            await users.data$.first().toPromise();

            Hal.clear();

            expect(spy).calledOnce;
            expect(users.resolveOptions(users.getLink('self'))).to.be.eqls(users.options);
        });
    });

    describe('#setItemConstructor', () => {
        it('should create items on data changes', async () => {
            Hal.init(
                {
                    http: new FakeHttp,
                    storage: new FakeStorage
                }
            );
            const users: PageableResource<User> = PageableResource
                .fromUrl<PageableResource<User>>('/users')
                .setItemConstructor(User);

            await users.data$.first().toPromise();

            Hal.clear();
            expect(users.items.length).to.be.equal(10);
        });

        it('should emit new items on data changes', (done) => {
            Hal.init(
                {
                    http: new FakeHttp,
                    storage: new FakeStorage
                }
            );
            const users: PageableResource<User> = PageableResource
                .fromUrl<PageableResource<User>>('/users')
                .setItemConstructor(User);
                
            users.items$.pipe(skip(1)).subscribe(items => {
                expect(items.length).to.be.equal(10);
                done();
            });

            Hal.clear();
        });
    });

    describe('#itemInstance', () => {
        it('should create a valid item instance', (done) => {
            Hal.init(
                {
                    http: new FakeHttp,
                    storage: new FakeStorage
                }
            );
            const users: PageableResource<User> = PageableResource
                .fromUrl<PageableResource<User>>('/users')
                .setItemConstructor(User);
                
            const user = users.itemInstance('/users/1');

            user.data$.subscribe(data => {
                expect(user.baseUrl).to.be.equal('/users/1');
                done();
            })

            Hal.clear();

            expect(user instanceof User).to.be.true;
        });

        it('should return same instance when called multiple times', (done) => {
            Hal.init(
                {
                    http: new FakeHttp,
                    storage: new FakeStorage,
                    enableCache: true
                }
            );
            Hal.clearCache();

            const users: PageableResource<User> = PageableResource
                .fromUrl<PageableResource<User>>('/users')
                .setItemConstructor(User);
                
            const user = users.itemInstance('/users/1');
            const sameUser = users.itemInstance('/users/1');

            expect(user).to.be.equal(sameUser);

            done();

            Hal.clear();
            Hal.clearCache();

        });

        it('should return not same instance when called multiple times with different url', (done) => {
            Hal.init(
                {
                    http: new FakeHttp,
                    storage: new FakeStorage,
                    enableCache: true
                }
            );
            Hal.clearCache();

            const users: PageableResource<User> = PageableResource
                .fromUrl<PageableResource<User>>('/users')
                .setItemConstructor(User);
                
            const user = users.itemInstance('/users/1');
            const otherUser = users.itemInstance('/users/2');

            expect(user).to.be.not.equal(otherUser);

            done();

            Hal.clear();
            Hal.clearCache();

        });

        it('should throw an exception if item constructor is not set', () => {
           
            const users: PageableResource<User> = new PageableResource('/users');
            expect(() => {
                users.itemInstance('/alias');
            }).to.throw(Error, "Item constructor not found.");
            
        });

    });

    describe('#set options', () => {
        it('should emit new options', (done) => {
            const users: PageableResource<User> = new PageableResource('/users');
            const newOptions = {page: 1, sort: [], filters: [], limit: 20};

            users.options$.subscribe(options => {
                expect(options).to.be.eqls(newOptions);
                done();
            });

            users.options = newOptions;
        });
    });

    describe('#flattenOptions', () => {
        it('should return a valid array', () => {
            const users: PageableResource<User> = new PageableResource('/users');

            const flat = users.flattenOptions({
                filters: [
                    {field: 'name', multiple: false, value: 'jon'},
                    {field: 'tags', multiple: true, value: 'human'},
                    {field: 'tags', multiple: true, value: 'bastard'},
                ],
                sort: [
                    {field: 'name', direction: true},
                    {field: 'age', direction: false},
                ],
                limit: 20,
                page: 1
            });

            expect(flat).to.be.eqls([
                {key: 'page', multiple: false, value: '1'},
                {key: 'limit', multiple: false, value: '20'},
                {key: 'sort', multiple: false, value: 'name,-age'},
                {key: 'name', multiple: false, value: 'jon'},
                {key: 'tags', multiple: true, value: 'human'},
                {key: 'tags', multiple: true, value: 'bastard'},
            ]);
        });
    });

    describe('#mergeOptionsChangeSet', () => {
        it('should merge correctly', () => {
            const users: PageableResource<User> = new PageableResource('/users');
            users.options = {
                page: 1, 
                sort: [{field: 'name', direction: true}], 
                filters: [], 
                limit: 20
            };

            let newOptions = users.mergeOptionsChangeSet({
                filters: [
                    {field: 'name', multiple: false, value: 'jon'},
                ]
            });

            expect(newOptions).to.be.eqls({
                page: 1, 
                sort: [{field: 'name', direction: true}], 
                filters: [
                    {field: 'name', multiple: false, value: 'jon'},
                ], 
                limit: 20
            });

            newOptions = users.mergeOptionsChangeSet({
                sort: [
                    {field: 'age', direction: false},
                ]
            });

            expect(newOptions).to.be.eqls({
                page: 1, 
                sort: [{field: 'age', direction: false}], 
                filters: [], 
                limit: 20
            });

            newOptions = users.mergeOptionsChangeSet({
                page: 10, 
            });

            expect(newOptions).to.be.eqls({
                page: 10, 
                sort: [{field: 'name', direction: true}], 
                filters: [], 
                limit: 20
            });

        });
    });

    describe('#resolveUrl', () => {
        it('should return a valid string', () => {
            const users: PageableResource<User> = new PageableResource('/users');
            
            users.options = {
                page: 1, 
                sort: [{field: 'name', direction: true}], 
                filters: [], 
                limit: 20
            };
            expect(users.resolveUrl()).to.be.equal('/users?page=1&limit=20&sort=name');

            users.options = {
                page: 1, 
                sort: [
                    {field: 'name', direction: true},
                    {field: 'age', direction: false}
                ], 
                filters: [], 
                limit: 20
            };
            expect(users.resolveUrl()).to.be.equal('/users?page=1&limit=20&sort=name,-age');

            users.options = {
                page: 1, 
                sort: [{field: 'name', direction: true}], 
                filters: [
                    {field: 'name', multiple: false, value: 'jon'},
                    {field: 'tag', multiple: true, value: 'human'},
                    {field: 'tag', multiple: true, value: 'bastard'},
                ], 
                limit: 20
            };
            expect(users.resolveUrl()).to.be.equal('/users?page=1&limit=20&sort=name&name=jon&tag[]=human&tag[]=bastard');
        });
    });

    describe('#resloveOptions', () => {
        it('should return a valid object', () => {
            const users: PageableResource<User> = new PageableResource('/users');
            let options = users.resolveOptions('/users?page=1&limit=20&sort=name&name=jon&tag[0]=human&tag[1]=bastard');
            expect(options).to.be.eqls({
                page: 1, 
                limit: 20,
                sort: [{field: 'name', direction: true}], 
                filters: [
                    {field: 'name', multiple: false, value: 'jon'},
                    {field: 'tag', multiple: true, value: 'human'},
                    {field: 'tag', multiple: true, value: 'bastard'},
                ], 
            });

            options = users.resolveOptions('/users?page=1&limit=20&sort=name,-age');

            expect(options).to.be.eqls({
                page: 1, 
                limit: 20,
                sort: [
                    {field: 'name', direction: true},
                    {field: 'age', direction: false}
                ], 
                filters: [], 
            });

            options = users.resolveOptions('/users?page=1&limit=20&sort=name');

            expect(options).to.be.eqls({
                page: 1, 
                limit: 20,
                sort: [
                    {field: 'name', direction: true},
                ], 
                filters: [], 
            });

        });
    });
});

