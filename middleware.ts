import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const role = token.role as Role;

    // Restriction zone admin
    if (pathname.startsWith("/admin")) {
      if (role !== Role.ADMIN) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clients/:path*",
    "/commercial/:path*",
    "/commerciaux/:path*",
    "/analyses/:path*",
    "/prospects/:path*",
    "/admin/:path*",
    "/api/dashboard/:path*",
    "/api/clients/:path*",
    "/api/ventes/:path*",
    "/api/analyses/:path*",
    "/api/prospects/:path*",
    "/api/admin/:path*",
    "/api/commercial/:path*",
    "/api/commerciaux",
  ],
};
