export function getRequestUserId(headerValue: string | string[] | undefined): string | undefined {
  if (typeof headerValue === "string" && headerValue.trim().length > 0) {
    return headerValue;
  }

  return undefined;
}
