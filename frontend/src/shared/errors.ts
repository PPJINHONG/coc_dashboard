import { ApiError } from "./api/client";

/** 화면에 보여 줄 오류 문구. 서버가 보낸 항목별 오류도 함께 붙입니다. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError))
    return "처리하지 못했습니다. 잠시 후 다시 시도하세요.";
  const details = Object.values(error.fieldErrors).flat().join(" ");
  return details ? `${error.message} ${details}` : error.message;
}
