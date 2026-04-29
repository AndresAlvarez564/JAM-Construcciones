import { get, post, put, del } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_NAME = 'JamApi';

const authHeaders = async (): Promise<Record<string, string>> => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

export const apiGet = async <T>(path: string): Promise<T> => {
  const { body } = await get({
    apiName: API_NAME, path,
    options: { headers: await authHeaders() },
  }).response;
  return (await body.json()) as T;
};

export const apiPost = async <T>(path: string, data: unknown): Promise<T> => {
  const { body } = await post({
    apiName: API_NAME, path,
    options: { headers: await authHeaders(), body: data as never },
  }).response;
  return (await body.json()) as T;
};

export const apiPut = async <T>(path: string, data: unknown): Promise<T> => {
  const { body } = await put({
    apiName: API_NAME, path,
    options: { headers: await authHeaders(), body: data as never },
  }).response;
  return (await body.json()) as T;
};

export const apiDelete = async <T>(path: string): Promise<T> => {
  const { body } = await del({
    apiName: API_NAME, path,
    options: { headers: await authHeaders() },
  }).response;
  return (await body.json()) as T;
};
