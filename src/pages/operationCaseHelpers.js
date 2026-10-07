export function defaultDuplicateName(testName) {
  const base = String(testName || "Untitled").trim() || "Untitled";
  if (/^copy of /i.test(base)) {
    return `${base} (2)`;
  }
  return `Copy of ${base}`;
}

export function caseUpdateFromView(item, patch, environmentId) {
  return {
    specId: item.specId,
    planId: item.planId,
    operationKey: item.operationKey,
    testName: item.testName,
    pathParams: item.pathParams,
    queryParams: item.queryParams,
    headers: item.headers,
    cookieParams: item.cookieParams,
    requestBody: item.requestBody,
    statusCode: item.statusCode,
    responseType: item.responseType,
    expectedResponse: item.expectedResponse,
    enabled: item.enabled,
    testGroup: item.testGroup,
    jsonPathAssertions: item.jsonPathAssertions,
    extracts: item.extracts,
    maxResponseTimeMs: item.maxResponseTimeMs,
    contentType: item.contentType,
    baseUrl: item.baseUrl,
    environmentId,
    ...patch
  };
}
