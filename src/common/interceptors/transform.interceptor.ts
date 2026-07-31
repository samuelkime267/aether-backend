import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response as ExpressResponse } from 'express';

export interface Response<T> {
  data: T;
  statusCode: number;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<ExpressResponse>();

    return next.handle().pipe(
      map((data) => ({
        statusCode: response.statusCode,
        data,
      })),
    );
  }
}
