
import {first} from 'rxjs/operators';
import { Hal } from './hal';
import { Subject, ReplaySubject, BehaviorSubject } from 'rxjs';


export interface ILink {
    href: string;
}

export interface IResource {
    [key: string]: any;
    _links: {
        self: ILink;
        [rel: string]: ILink | undefined;
    };
    _embedded?: {
        [rel: string]: any;
    };
}

export interface IChangeSet {
    [key: string]: any;
}

export class Resource<I extends IResource> {
    private _data$: ReplaySubject<I> = new ReplaySubject<I>(1);
    private _data: I | null = null;
    private _isLoading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    protected _alias: string;

    protected _changeSet: IChangeSet = {};

    constructor(alias: string) {
        this._alias = alias;
        
        Hal
            .aliasData$(alias)
            .subscribe(data => {
                this._data$.next(<I>data);
            });

        this._data$.subscribe(data => {
            this.isLoading = false;
            this._data = data;
        });

        const origin = Hal.getOrigin(alias);
        if (origin) {
            this._data$.next(<I>Hal.getItem(origin));
        }

    }
   
    static fromUrl<T extends Resource<any>>(url: string, options?: any, name?: string): T {
        const cachedResource = Hal.getCache(url);
        const resource = cachedResource ? cachedResource : new this(url);
        Hal.setCache(url, resource);

        const data = Hal.getItem(url);

        if (data) {
            Hal.setItem(url, data);
        } else {
            resource.isLoading = true;
            Hal.follow(url, options, name);
        }

        return <T>resource;
    }

    static fromEmbedded<T extends Resource<any>>(parentResource: Resource<any>, rel: string, name?: string): T {
        const resoureceName = parentResource.resolveEmbeddedName(name ? name : rel);
        const cachedResource = Hal.getCache(resoureceName);
        const resource = cachedResource ? cachedResource : new this(resoureceName);
        Hal.setCache(resoureceName, resource);

        return <T>resource;
    }

    static fromLink<T extends Resource<any>>(parentResource: Resource<any>, rel: string, options?: any, name?: string): T {
        const resoureceName = parentResource.resolveLinkName(name ? name : rel);
        const cachedResource = Hal.getCache(resoureceName);
        const resource = cachedResource ? cachedResource : new this(resoureceName);
        Hal.setCache(resoureceName, resource);

        parentResource
            .data$
            .asObservable().pipe(
            first())
            .toPromise()
            .then(data => {
                const url = Hal.getLink(data, rel);
                if (url) {
                    resource.isLoading = true;
                    Hal.follow(url, options, resoureceName);
                }
            });

        return <T>resource;
    }

    static fromData<T extends Resource<any>>(data: IResource): T {
        const cachedResource = Hal.getCache(data._links.self.href);
        const resource = cachedResource ? cachedResource : new this(data._links.self.href);
        Hal.setCache(data._links.self.href, resource);

        Hal.attach(data._links.self.href, data._links.self.href);
        Hal.setItem(data._links.self.href, data);
        return <T>resource;
    }

    revert() {
        this.clearChangeSet();
    }

    commit() {
        const commit$ = new Subject<I>();
        const url = this.getLink('self');
        
        this.isLoading = true;
        Hal
            .http
            .patch(url, this._changeSet)
            .toPromise()
            .then(data => {
                if (this._alias) {
                    Hal.attach(data._links.self.href, this._alias);
                }
                Hal.attach(data._links.self.href, url);
                Hal.setItem(data._links.self.href, data);
                this.clearChangeSet();
                commit$.next(<I>data);
                commit$.complete();
            });
        return commit$;    
    }

    refresh() {
        const refresh$ = new Subject<I>();
        const url = this.getLink('self');
        
        Hal.removeSiblings(this.baseUrl);

        this.isLoading = true;
        Hal
            .http
            .get(url, this._changeSet)
            .toPromise()
            .then(data => {
                Hal.attach(data._links.self.href, this._alias);
                Hal.attach(data._links.self.href, url);
                Hal.setItem(data._links.self.href, data);
                this.clearChangeSet();
                refresh$.next(<I>data);
                refresh$.complete();
            });
        return refresh$;    
    }

    delete() {
        const delete$ = new Subject<any>();
        const url = this.getLink('self');

        this.isLoading = true;
        Hal
            .http
            .delete(url)
            .toPromise()
            .then(_ => {
                Hal.detach(this._alias);
                Hal.detach(url);
                if (this.data) {
                    Hal.removeItem(this.data._links.self.href);
                }
                this.clearChangeSet();
                this._data = null;
                delete$.next();
                delete$.complete();
            });
        return delete$; 
    }

    clearChangeSet() {
        this._changeSet = {};
    }

    get alias() {
        return this._alias;
    }

    get data$() {
        return this._data$;
    }

    get data() {
        return this._data;
    }

    get hasData() {
        return !!this._data;
    }

    get isLoading$() {
        return this._isLoading$;
    }

    set isLoading(isLoading: boolean) {
        this._isLoading$.next(isLoading);
    }

    get isLoading() {
        return this._isLoading$.value;
    }

    hasLink(rel: string) {
        return this.data && rel in this.data._links;
    }

    get baseUrl() {
        return Hal.resloveBaseUrl(this.getLink('self'));
    }

    get<R>(prop: string, defaultValue?: R): R | undefined {
        return this.data ? this.data[prop] : defaultValue;
    }

    set(prop: string, value: any) {
        this._changeSet[prop] = value;
    }

    resolveEmbeddedName(rel: string) {
        return Hal.resolveEmbeddedName(this._alias, rel);
    }

    resolveLinkName(rel: string) {
        return Hal.resolveLinkName(this._alias, rel);
    }

    getLink(rel: string) {
        if (this.data) {
            return Hal.getLink(this.data, rel);
        }
        throw new Error(`Data not found.`);
    }

    getEmbedded<R>(rel: string, defaultValue?: R): R | undefined {
        if (this.data) {
            return Hal.getEmbedded(this.data, rel, defaultValue);
        }
        return defaultValue;
    }

}