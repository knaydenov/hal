import { Observable } from 'rxjs';
import { IResource } from './resource';

export interface IHttpService {
    get: <I extends IResource>(url: string, options?: any) => Observable<I>;
    post: <I extends IResource>(url: string, data: any, options?: any) => Observable<I>;
    patch: <I extends IResource>(url: string, data: any, options?: any) => Observable<I>;
    delete: <I extends IResource>(url: string, options?: any) => Observable<null>;
};