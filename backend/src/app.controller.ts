import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  getHello(): { message: string } {
    return { message: "ViralFX Backend API is running!" };
  }

  @Get("health")
  getHealth(): { status: string; timestamp: string } {
    return {
      status: "OK",
      timestamp: new Date().toISOString()
    };
  }
}
