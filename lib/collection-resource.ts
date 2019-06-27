import { IResource, Resource, IChangeSet } from "./resource";
import * as queryString from 'query-string';
import { Subject, BehaviorSubject } from "rxjs";
import { Hal } from "./hal";

export interface ICollectionResource extends IResource {
    _links: {
        self: {
            href: string
        };
    };
    _embedded: {
        items: any[]
    };
}

export interface IFilter {
    field: string;
    multiple: boolean;
    value: string;
};

export interface IOptions {
    filters: IFilter[];
}

export interface IOptionsChangeSet extends IChangeSet {
    filters?: IFilter[];
}

export interface IOption {
    key: string;
    multiple: boolean;
    value: string;
}

export class CollectionResource<T> extends Resource<any> {
    protected _changeSet: IOptionsChangeSet = {};
    protected _items: T[] = [];

    private _options: IOptions = {
        filters: []
    };
    private _options$: Subject<IOptions> = new Subject<IOptions>();
    private _items$: BehaviorSubject<T[]> = new BehaviorSubject<T[]>([]);
    
    constructor(alias: string) {
        super(alias);
        this.data$.subscribe(data => {
            if (data) {
                this.options = this.resolveOptions(data._links.self.href);
                this._items = data._embedded.items;
                this.items$.next(this.items);
            }
        });
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
        const commit$ = new Subject<ICollectionResource>();

        this.isLoading = true;
        Hal
            .http
            .get<ICollectionResource>(this.resolveUrl())
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

    get items$() {
        return this._items$;
    }

    get items(): T[] {
        return this._items;
    }

    resolveOptions(url: string): IOptions {
        const options: IOptions = {
            filters: []
        };
        const query = CollectionResource.parseUrl(url).query;

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
                } else if (typeof filter.value === 'string') {
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

    flattenOptions(options: IOptions) {
        const flatOptions: IOption[] = [];
        
        options.filters.forEach(filter => flatOptions.push(
            {
                key: filter.field, 
                value: filter.value,
                multiple: filter.multiple
            }
        ));

        return flatOptions;
    }

    private static parseUrl(url: string): queryString.ParsedUrl {
        return queryString.parseUrl(url, {arrayFormat: 'index'});
    }

    mergeOptionsChangeSet(options: IOptionsChangeSet): IOptions {
        return Object.assign({}, this.options, options);
    }

    resolveUrl(): string {
        const queryString = this.flattenOptions(this.mergeOptionsChangeSet(this._changeSet))
            .map(option => `${option.key}${option.multiple ? '[]' : ''}=${option.value}`)
            .join('&');
        return `${Hal.resloveBaseUrl(this.baseUrl)}?${queryString}`;
    }

}
