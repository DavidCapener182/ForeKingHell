// Next discovers Proxy at the same level as src/app. Keep the request policy in
// the root module so its existing unit coverage and imports remain stable.
export { proxy } from "../proxy";

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
