// 게시판 API: 타입 정의 + 호출 함수
import { request, upload } from './client';
import { prepareImage } from './image';

export interface PostListItem {
  id: number;
  title: string;
  author: string;
  created_at: string;
  updated_at: string;
  comment_count: number;
  image_count: number;
}

export interface PostImage {
  id: number;
  url: string;
}

export interface Comment {
  id: number;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
  is_mine: boolean;
}

export interface PostDetail {
  id: number;
  title: string;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
  is_mine: boolean;
  images: PostImage[];
  comments: Comment[];
}

export interface PostCreate {
  title: string;
  content: string;
  image_ids?: number[];
}

export interface PostUpdate {
  title?: string;
  content?: string;
  image_ids?: number[];
}

// --- 게시글 ---
export function listPosts(): Promise<PostListItem[]> {
  return request<PostListItem[]>('GET', '/api/board/posts/');
}

export function getPost(id: number): Promise<PostDetail> {
  return request<PostDetail>('GET', `/api/board/posts/${id}/`);
}

export function createPost(body: PostCreate): Promise<PostDetail> {
  return request<PostDetail>('POST', '/api/board/posts/', body);
}

export function updatePost(id: number, body: PostUpdate): Promise<PostDetail> {
  return request<PostDetail>('PATCH', `/api/board/posts/${id}/`, body);
}

export function deletePost(id: number): Promise<void> {
  return request<void>('DELETE', `/api/board/posts/${id}/`);
}

// --- 댓글 ---
export function addComment(postId: number, content: string): Promise<Comment> {
  return request<Comment>('POST', `/api/board/posts/${postId}/comments/`, { content });
}

export function updateComment(commentId: number, content: string): Promise<Comment> {
  return request<Comment>('PATCH', `/api/board/comments/${commentId}/`, { content });
}

export function deleteComment(commentId: number): Promise<void> {
  return request<void>('DELETE', `/api/board/comments/${commentId}/`);
}

// --- 이미지 ---
// 업로드 전 용량을 900KB 이하로 축소한 뒤 multipart(field명 'file')로 전송한다.
export async function uploadImage(file: File): Promise<PostImage> {
  const prepared = await prepareImage(file);
  const formData = new FormData();
  formData.append('file', prepared.file);
  return upload<PostImage>('/api/board/images/', formData);
}
