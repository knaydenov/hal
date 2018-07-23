import { Observable } from 'rxjs/Observable';
import { IResource } from './resource';

export interface IHttpService {
    get: <I extends IResource>(url: string, options?: any) => Observable<I | null>;
    post: <I extends IResource>(url: string, data: any, options?: any) => Observable<I | null>;
    patch: <I extends IResource>(url: string, data: any, options?: any) => Observable<I | null>;
    delete: <I extends IResource>(url: string, options?: any) => Observable<I | null>;
};