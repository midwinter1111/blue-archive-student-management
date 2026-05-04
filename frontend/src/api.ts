import type { Student, CaptureResult, StudentUpdate, FilterState } from "./types";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "エラーが発生しました");
  }
  return res.json() as Promise<T>;
}

export async function fetchStudents(filters: FilterState): Promise<Student[]> {
  const params = new URLSearchParams();
  if (filters.name) params.set("name", filters.name);
  if (filters.join === "joined") params.set("joined_only", "true");
  if (filters.join === "not_joined") params.set("not_joined_only", "true");
  return request<Student[]>(`/students?${params}`);
}

export async function updateStudent(id: number, data: StudentUpdate): Promise<Student> {
  return request<Student>(`/students/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function createStudent(name: string): Promise<Student> {
  return request<Student>("/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function resetStudentStatus(id: number): Promise<void> {
  await request(`/students/${id}/status`, { method: "DELETE" });
}

export async function triggerCapture(): Promise<CaptureResult> {
  return request<CaptureResult>("/capture/trigger", { method: "POST" });
}

export async function getPendingCapture(): Promise<CaptureResult | null> {
  return request<CaptureResult | null>("/capture/pending");
}

export async function clearPendingCapture(): Promise<void> {
  await request("/capture/pending", { method: "DELETE" });
}

export async function checkStatus(): Promise<{
  ok: boolean;
  game_window_found: boolean;
  window_size: { width: number; height: number } | null;
}> {
  return request("/status");
}

export async function fetchMasterStudents(): Promise<string[]> {
  return request<string[]>("/master/students");
}

export async function fetchDebugCapture(): Promise<{
  width: number;
  height: number;
  image: string;
}> {
  return request("/debug/capture");
}

export interface WindowInfo {
  hwnd: number;
  title: string;
  process: string;
  is_browser: boolean;
}

export async function fetchDebugWindows(): Promise<{
  target_title: string;
  detected_hwnd: number | null;
  windows: WindowInfo[];
}> {
  return request("/debug/windows");
}
