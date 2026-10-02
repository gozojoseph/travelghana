import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { MessageResponse, SessionUser } from "@travelghana/types";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@travelghana/validation";

import { ApiError } from "../../common/errors/api-error";
import { AuthenticatedRequest } from "../../common/guards/session.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { z } from "zod";

import { AuthService, SESSION_COOKIE } from "./auth.service";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

const SESSION_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60; // mirrors session TTL

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: z.infer<typeof registerSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register({
      name: body.name,
      email: body.email,
      password: body.password,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    this.setSessionCookie(res, result.sessionToken, result.sessionExpiresAt);
    return { user: result.user };
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login({
      email: body.email,
      password: body.password,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    this.setSessionCookie(res, result.sessionToken, result.sessionExpiresAt);
    return { user: result.user };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response): Promise<MessageResponse> {
    await this.authService.logout(req);
    res.clearCookie(SESSION_COOKIE);
    return { message: "Logged out" };
  }

  @Get("me")
  async me(@CurrentUser() user?: SessionUser): Promise<{ user: SessionUser }> {
    if (!user) throw ApiError.unauthorized();
    return { user };
  }

  // Public by necessity: the token arrives in a link the user opens from their
  // mailbox, typically on a different device with no TravelGhana session. The
  // 256-bit single-use token (hashed at rest, 1h expiry) is the authorisation.
  @Public()
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: z.infer<typeof verifyEmailSchema>,
  ): Promise<MessageResponse> {
    await this.authService.verifyEmail(body.token);
    return { message: "Email verified" };
  }

  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  async resendVerification(@CurrentUser() user?: SessionUser): Promise<MessageResponse> {
    if (!user) throw ApiError.unauthorized();
    await this.authService.requestEmailVerification(user.id);
    return { message: "Verification email sent" };
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: z.infer<typeof forgotPasswordSchema>,
  ): Promise<MessageResponse> {
    await this.authService.forgotPassword(body.email);
    return { message: "If an account exists for that email, a reset link has been sent" };
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: z.infer<typeof resetPasswordSchema>,
  ): Promise<MessageResponse> {
    await this.authService.resetPassword(body.token, body.password);
    return { message: "Password updated — please log in" };
  }

  private setSessionCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
  }
}
