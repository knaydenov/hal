
import {of as observableOf,  Observable } from 'rxjs';
import { IResource, Resource } from '../resource';
import { IHttpService } from '../http-service';

import { IPageableResource } from '../pageable-resource';

export interface IUser extends IResource {

}

export class User extends Resource<IUser> {
    
}

export interface IAnimal extends IResource {
    name: string,
    species: string
}

export class FakeHttp  implements IHttpService {
    fluffy: IAnimal = {
        _links: {
            self: {
                href: '/pets/fluffy'
            }
        },
        name: 'Fluffy',
        species: 'cat'
    };

    spike: IAnimal = {
        _links: {
            self: {
                href: '/pets/spike'
            }
        },
        name: 'Spike',
        species: 'dog'
    };

    tom: IAnimal = {
        _links: {
            self: {
                href: '/pets/spike'
            }
        },
        name: 'Spike',
        species: 'dog'
    };

    me: IResource = {
        _links: {
            self: {
                href: '/me'
            }
        }
    }

    usersPage1: IResource[] = [
        { _links: { self: { href: '/users/1' } } },
        { _links: { self: { href: '/users/2' } } },
        { _links: { self: { href: '/users/3' } } },
        { _links: { self: { href: '/users/4' } } },
        { _links: { self: { href: '/users/5' } } },
        { _links: { self: { href: '/users/6' } } },
        { _links: { self: { href: '/users/7' } } },
        { _links: { self: { href: '/users/8' } } },
        { _links: { self: { href: '/users/9' } } },
        { _links: { self: { href: '/users/10' } } },
        
    ];

    usersPage2: IResource[] = [
        { _links: { self: { href: '/users/11' } } },
        { _links: { self: { href: '/users/12' } } },
        { _links: { self: { href: '/users/13' } } },
        { _links: { self: { href: '/users/14' } } },
        { _links: { self: { href: '/users/15' } } },
        { _links: { self: { href: '/users/16' } } },
        
    ];

    usersPages = [
        this.usersPage1, this.usersPage2
    ];

    usersCurrentPageIndex = 0;

    users: IPageableResource = {
        _links: {
            self: { href: `/users?page=${this.usersCurrentPageIndex+1}`},
            first: { href: '/users?page=1'},
            last: { href: '/users?page=2'},
        },
        _embedded: {
            items: this.usersPages[this.usersCurrentPageIndex]
        },
        page: this.usersCurrentPageIndex + 1,
        pages: this.usersPages.length,
        limit: 10,
        total: this.usersPages.map(page => page.length).reduce((acc, curr) => acc += curr)
    }
    

    private _data: {[key: string]: any} = {
        '/pets':  {
            _embedded: {
                items: [ this.fluffy, this.spike, this.tom]
            },
            _links: {
                self: {
                    href: '/pets'
                }
            }
        },
        '/species': {
            _embedded: {
                items: ['cat', 'dog', 'bird']
            },
            _links: {
                self: {
                    href: '/species'
                }
            }
        },
        '/me': this.me,
        '/self': this.me,
        '/users': this.users
    };

    get<I extends IResource>(url: string, options?: any): Observable<I> {
        return observableOf(this._data[url]);
    }

    post<I extends IResource>(url: string, data: any, options?: any):Observable<I> {
        return observableOf(this._data[url]);
    }

    patch<I extends IResource>(url: string, data: any, options?: any): Observable<I> {
        return observableOf(this._data[url]);
    }

    delete(url: string, options?: any): Observable<null> {
        return observableOf(null);
    }
}