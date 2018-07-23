import { IHttpService } from "./http-service";
import { BehaviorSubject, Subject } from "rxjs";
import 'rxjs/add/operator/first';

export type IPath = string[];

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

export interface IConfig {
    http: IHttpService,
    keyPrefix?: string;
}

export class Resource<I extends IResource> {
    private static _resources: Resource<IResource>[] = [];
    private static _http: IHttpService;
    private _name: string;
    private _baseUrl: string | null = null;
    private _data$: BehaviorSubject<I | null>;
    private _isLoading$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    protected _changeSet: { [name: string]: any } = {};

    constructor(name: string) {
        this._name = name;
        this._data$  = new BehaviorSubject<I | null>(null);
    }

    static init(config: IConfig) {
        Resource._http = config.http;
    }

    static clear() {
        let resource: Resource<IResource> | undefined;
        while(resource = Resource._resources.pop()) {
            Resource.remove(resource);
        }
    }

    protected static has(name: string) {
        return !!Resource.get(name);
    }

    protected static get(name: string) {
        return Resource._resources.find(resource => resource._name === name);
    }

    protected static add(resource: Resource<IResource>) {
        Resource._resources.push(resource);
        return resource;
    }

    protected static remove(resource: Resource<IResource>) {
        let index = Resource._resources.indexOf(resource);
        if (index !== -1) {
            Resource._resources.splice(index, 1);
        }
    }

    static instance<T extends Resource<IResource>>(name: string): T {
        let resource: T = <T>Resource.get(name);
        if (!resource) {
            resource = <T>Resource.add(new this(name));
        }
        return resource;
    }

    static getLink(data: IResource, rel: string) {
        const link = data._links[rel];
        if (!link) {
            throw new Error(`Link '${rel}' not found.`);
        }
        return link.href;
    }

    getLink(rel: string) {
        if (!this.data) {
            throw new Error('Data not found.');
        }
        return Resource.getLink(this.data, rel);
    }

    static getEmbedded(data: IResource, rel: string) {
        if (!data._embedded || !data._embedded[rel]) {
            throw new Error(`Embedded '${rel}' not found.`);
        }
        return data._embedded[rel];
    }

    getEmbedded<R>(rel: string, defaultValue?: any): R {
        if (!this.data) {
            return defaultValue;
        }
        return Resource.getEmbedded(this.data, rel);
    }

    static fromUrl<T extends Resource<IResource>>(url: string, options?: any): T {
        const resourceName = url;
        let resource: T = <T>Resource.get(resourceName);
        if (!resource) {
            resource = <T>Resource.add(new this(resourceName)).fromUrl(url, options);
        }
        return resource;
    }

    fromUrl(url: string, options?: any) {
        this._baseUrl = Resource.resolveBaseUrl(url);
        this.isLoading = true;
        Resource
            .http
            .get<I>(url, options)
            .first()
            .toPromise()
            .then(data => {
                this.data = data;
                this.clearChangeSet();
            });

        return this;
    }

    static fromData<T extends Resource<IResource>>(data: IResource): T {
        const resourceName = Resource.getLink(data, 'self');
        let resource: T = <T>Resource.get(resourceName);
        if (!resource) {
            resource = <T>Resource.add(new this(resourceName)).fromData(data);
        }
        return resource;
    }

    fromData(data: I) {
        this.data = data;
        return this;
    }

    static fromEmbedded<T extends Resource<IResource>>(parentResource: Resource<IResource>, rel: string): T {
        const resourceName = parentResource.resloveChildName(rel);
        let resource: T = <T>Resource.get(resourceName);
        if (!resource) {
            resource = <T>Resource.add(new this(resourceName)).fromEmbedded(parentResource, rel);
        }
        return resource;
    }

    fromEmbedded(parentResource: Resource<IResource>, rel: string) {
        parentResource.data$.subscribe(data => {
            if (data) {
                this.data = Resource.getEmbedded(data, rel);
            }
        })
        return this;
    }

    static fromLink<T extends Resource<IResource>>(name: string, parentResource: Resource<IResource>, rel: string, options?: any): T {
        const resourceName = parentResource.resloveChildName(name);
        let resource: T = <T>Resource.get(resourceName);
        if (!resource) {
            resource = <T>Resource.add(new this(resourceName)).fromLink(parentResource, rel, options);
        }
        return resource;
    }

    fromLink(parentResource: Resource<IResource>, rel: string, options?: any) {
        parentResource
                .data$
                .subscribe(data => {
                    if (data) {
                        this.fromUrl(Resource.getLink(data, rel), options);
                    }
                });
            return this;
    }

    resloveChildName(rel: string) {
        return `${this._name}#${rel}`;
    }

    static resolveBaseUrl(url: string) {
        return url.split('?')[0];
    }

    static getBaseUrl(data: IResource) {
        return Resource.resolveBaseUrl(Resource.getLink(data, 'self'));
    }

    get baseUrl() {
        if (!this._baseUrl) {
            throw new Error('Baseurl not found.');
        }
        return this._baseUrl;
    }

    static get http() {
        return this._http;
    }

    get data$() {
        return this._data$;
    }

    get data() {
        return this._data$.value;
    }

    set data(data: I | null) {
        this._data$.next(data);
        this.isLoading = false;
    }

    get isLoading$() {
        return this._isLoading$;
    }

    get isLoading() {
        return this.isLoading$.value;
    }

    set isLoading(isLoading: boolean) {
        this.isLoading$.next(isLoading);
    }

    clearChangeSet() {
        this._changeSet = {};
    }

    get<R>(prop: string): R {
        return this.data ? this.data[prop] : null;
    }

    set(prop: string, value: any) {
        this._changeSet[prop] = value;
    }

    revert() {
        this.clearChangeSet();
    }

    commit() {
        const commit$ = new Subject<I | null>();
        Resource
            .http
            .patch<I>(this.getLink('self'), this._changeSet)
            .toPromise()
            .then(data => {
                this.clearChangeSet();
                this.data = data;
                commit$.next(data);
                commit$.complete();
            });
            return commit$;
    }

    refresh() {
        const refresh$ = new Subject<I | null>();
        Resource
            .http
            .get<I>(this.getLink('self'))
            .toPromise()
            .then(data => {
                this.data = data;
                refresh$.next(data);
                refresh$.complete();
            });
        return refresh$    
    }

    delete() {
        const delete$ = new Subject<I | null>();
        Resource
            .http
            .delete<I>(this.getLink('self'))
            .toPromise()
            .then(data => {
                this.data = data;
                delete$.next(data);
                delete$.complete();
            });
        return delete$  ;      
    }
}