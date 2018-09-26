import { IResource, IChangeSet, Resource } from "./resource";
import { ICollectionResource } from "./collection-resource";
import { Subject, BehaviorSubject } from "rxjs";
import { Hal } from "./hal";
import * as queryString from 'query-string';

export interface ISort {
    field: string;
    direction: boolean;
};

export interface IFilter {
    field: string;
    multiple: boolean;
    value: string;
};

export interface IOptions {
    page: number;
    limit: number;
    sort: ISort[];
    filters: IFilter[];
}

export interface IOptionsChangeSet extends IChangeSet {
    page?: number;
    limit?: number;
    sort?: ISort[];
    filters?: IFilter[];
}

 export interface IOption {
     key: string;
     multiple: boolean;
     value: string;
 }

export interface IPageableResource extends ICollectionResource {
    page: number;
    limit: number;
    pages: number;
    total: number;
    _links: {
        self: {
            href: string
        };
        first: {
            href: string
        };
        last: {
            href: string
        };
        next?: {
            href: string
        };
        previous?: {
            href: string
        };
    };
    _embedded: {
        items: IResource[]
    };
}

export class PageableResource<T extends Resource<IResource>> extends Resource<IPageableResource> { 
    protected _changeSet: IOptionsChangeSet = {};
    protected _items: T[] = [];

    private _options: IOptions = {
        page: 1,
        limit: 10,
        sort: [],
        filters: []
    };
    private _options$: Subject<IOptions> = new Subject<IOptions>();

    private _itemConstructor: (new (alias: string) => T) | undefined;
    private _items$: BehaviorSubject<T[]> = new BehaviorSubject<T[]>([]);
    
    constructor(alias: string) {
        super(alias);
        this.data$.subscribe(data => {
            if (data) {
                this.options = this.resloveOptions(data._links.self.href);
            }
        });
    }

    setItemConstructor(itemConstructor: new (alias: string) => T) {
        this._itemConstructor = itemConstructor;
        this.data$.subscribe(data => {
            // Checking if data exists. It may be removed by refresh() method.
            if (data) {
                this._items = data._embedded.items.map(item => this.itemInstance(item._links.self.href));
                this.items$.next(this.items);
                data._embedded.items.forEach(item => {
                    Hal.attach(item._links.self.href, item._links.self.href);
                    Hal.setItem(item._links.self.href, item);
                });
            }
        });
        return this;
    }

    itemInstance(alias: string): T {
        if (!this._itemConstructor) {
            throw new Error('Item constructor not found.');
        }
        return new this._itemConstructor(alias);
    }

    get items$() {
        return this._items$;
    }

    get items(): T[] {
        return this._items;
    }

    get page(): number {
        return this.options.page;
    }

    set page(page: number) {
        this.set('page', page);
    }

    get limit(): number {
        return this.options.limit;
    }

    set limit(limit: number) {
        this.set('limit', limit);
    }

    get pages() {
        return this.get<number>('pages');
    }

    get total() {
        return this.get<number>('total');
    }

    get sort(): ISort[] {
        return this.options.sort;
    }

    set sort(sort: ISort[]) {
        this.set('sort', sort);
    }

    get filters(): IFilter[] {
        return this.options.filters;
    }

    set filters(filters: IFilter[]) {
        this.set('filters', filters);
    }

    get options() {
        return this._options;
    }

    set options(options: IOptions) {
        this._options = options;
        this.options$.next(this._options);
    }

    get options$() {
        return this._options$;
    }

    commit() {
        const commit$ = new Subject<IPageableResource>();

        this.isLoading = true;
        Hal
            .http
            .get<IPageableResource>(this.resolveUrl())
            .toPromise()
            .then(data => {
                this.clearChangeSet();
                Hal.attach(data._links.self.href, this._alias);
                Hal.setItem(data._links.self.href, data);
                commit$.next(data);
                commit$.complete();
            });
        return commit$;    
    }

    navigateFirst() {
        const commit$ = new Subject<IPageableResource>();

        this.isLoading = true;
        Hal
            .http
            .get<IPageableResource>(this.getLink('first'))
            .toPromise()
            .then(data => {
                this.clearChangeSet();
                Hal.attach(data._links.self.href, this._alias);
                Hal.setItem(data._links.self.href, data);
                commit$.next(data);
                commit$.complete();
            });
        return commit$;  
    }

    navigatePrevious() {
        const commit$ = new Subject<IPageableResource>();

        this.isLoading = true;
        Hal
            .http
            .get<IPageableResource>(this.getLink('previous'))
            .toPromise()
            .then(data => {
                this.clearChangeSet();
                Hal.attach(data._links.self.href, this._alias);
                Hal.setItem(data._links.self.href, data);
                commit$.next(data);
                commit$.complete();
            });
        return commit$;
    }

    navigateNext() {
        const commit$ = new Subject<IPageableResource>();

        this.isLoading = true;
        Hal
            .http
            .get<IPageableResource>(this.getLink('next'))
            .toPromise()
            .then(data => {
                this.clearChangeSet();
                Hal.attach(data._links.self.href, this._alias);
                Hal.setItem(data._links.self.href, data);
                commit$.next(data);
                commit$.complete();
            });
        return commit$;
    }

    navigateLast() {
        const commit$ = new Subject<IPageableResource>();

        this.isLoading = true;
        Hal
            .http
            .get<IPageableResource>(this.getLink('last'))
            .toPromise()
            .then(data => {
                this.clearChangeSet();
                Hal.attach(data._links.self.href, this._alias);
                Hal.setItem(data._links.self.href, data);
                commit$.next(data);
                commit$.complete();
            });
        return commit$;
    }

    get isFirst() {
        return this.getLink('self') === this.getLink('first');
    }

    get hasPrevious() {
        return this.hasLink('previous'); 
    }

    get hasNext() {
        return this.hasLink('next'); 
    }

    get isLast() {
        return this.getLink('self') === this.getLink('last');
    }

    addItem(data: any, options?: any) {
        const addItem$ =  new Subject<IResource>();
        this
            .data$
            .first()
            .toPromise()
            .then(_=> {
                Hal
                    .http
                    .post(this.baseUrl, data, options)
                    .toPromise()
                    .then(item => {
                        addItem$.next(item);
                        addItem$.complete();
                    });
            })
     
        return addItem$;  
    }

    private flattenOptions(options: IOptions) {
        const flatOptions: IOption[] = [];

        flatOptions.push({
            key: 'page',
            value: options.page.toString(),
            multiple: false
        });
        flatOptions.push({
            key: 'limit',
            value: options.limit.toString(),
            multiple: false
        });
        
        if (options.sort.length) {
            flatOptions.push(
                {
                    key: 'sort', 
                    value: options.sort.map(item => `${item.direction ? '' : '-'}${item.field}`).join(','),
                    multiple: false
                }
            );
        }
        
        options.filters.forEach(filter => flatOptions.push(
            {
                key: filter.field, 
                value: filter.value,
                multiple: filter.multiple
            }
        ));

        return flatOptions;
    }

    private static parseUrl(url: string): { url: string; query: {[key: string]: string}} {
        return queryString.parseUrl(url, {arrayFormat: 'index'});
    }

    private mergeOptionsChangeSet(options: IOptionsChangeSet): IOptions {
        return Object.assign({}, this.options, options);
    }

    private resolveUrl(): string {
        const queryString = this.flattenOptions(this.mergeOptionsChangeSet(this._changeSet))
            .map(option => `${option.key}${option.multiple ? '[]' : ''}=${option.value}`)
            .join('&');
        return `${Hal.resloveBaseUrl(this.baseUrl)}?${queryString}`;
    }

    private resloveOptions(url: string): IOptions {
        const options: IOptions = {
            page: 1,
            limit: 10,
            sort: [],
            filters: []
        };
        const query = PageableResource.parseUrl(url).query;

        if (query.page) {
            options.page = parseInt(query.page, 10);
        }

        if (query.limit) {
            options.limit = parseInt(query.limit, 10);
        }

        if (query.sort) {
            options.sort = query.sort.split(',').map(part => {
                let [, direction, field] = part.match(/(-)?(\w+)/);
                return {field: field, direction: direction !== '-' };
            });
        }

        const filters: IFilter[] = [];

        Object
            .keys(query)
            .filter(key => ['page', 'limit', 'sort']
            .indexOf(key) === -1)
            .map(key => {
                return {field: key, value: query[key]};
            }).forEach(filter => {
                if (Array.isArray(filter.value)) {
                    filter.value.forEach(value => {
                        filters.push({
                            field: filter.field,
                            multiple: true,
                            value: value
                        });
                    })
                } else {
                    filters.push({
                        field: filter.field,
                        multiple: false,
                        value: filter.value
                    });
                }
                
            });
        options.filters = filters;
        return options;
    }
}