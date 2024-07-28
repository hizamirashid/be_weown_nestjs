/**
 * Copyright 2023, the hatemragab project author.
 * All rights reserved. Use of this source code is governed by a
 * MIT license that can be found in the LICENSE file.
 */

import {Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query} from '@nestjs/common';

import {VerifiedAuthGuard} from "../../../core/guards/verified.auth.guard";
import {resOK} from "../../../core/utils/res.helpers";

import {CreateCallMemberDto} from "./dto/create-call_member.dto";
import {AcceptCallMemberDto} from "./dto/accept-call_member.dto";
import {CallService} from "./call.service";
import {MongoMeetIdDto} from "../../../core/common/dto/mongo.meet.id.dto";
import {MongoRoomIdDto} from "../../../core/common/dto/mongo.room.id.dto";
import {V1Controller} from "../../../core/common/v1-controller.decorator";
import {MongoIdDto} from "../../../core/common/dto/mongo.id.dto";

@UseGuards(VerifiedAuthGuard)
@V1Controller('call')
export class CallController {
    constructor(private readonly callService: CallService) {
    }

    @Get('/active')
    async getRingCall(@Req() req: any) {
        return resOK(await this.callService.getRingCall(req.user._id))
    }

    @Get('/agora-access/:roomId')
    async getAgoraAccess(@Req() req: any, @Param() dto: MongoRoomIdDto) {
        dto.myUser = req.user;
        return resOK(await this.callService.getAgoraAccess(dto))
    }

    @Post('/create/:roomId')
    async createCall(
        @Req() req: any,
        @Param() roomIdDto: MongoRoomIdDto,
        @Body() dto: CreateCallMemberDto,
    ) {
        dto.myUser = req.user;
        dto.roomId = roomIdDto.roomId
        return resOK(await this.callService.createCall(dto))
    }

    @Post('/accept/:meetId')
    async acceptCall(
        @Req() req: any,
        @Param() meetIdDto: MongoMeetIdDto,
        @Body() dto: AcceptCallMemberDto
    ) {
        dto.myUser = req.user;
        dto.meetId = meetIdDto.meetId
        return resOK(await this.callService.acceptCall(dto))
    }

    ///DEPRECATED
    @Post('/cancel/:meetId')
    async cancelCall(@Req() req: any, @Param() dto: MongoMeetIdDto) {
        dto.myUser = req.user;
        return resOK(await this.callService.cancelCall(dto))
    }

    ///DEPRECATED
    @Post('/reject/:meetId')
    async rejectCall(@Req() req: any, @Param() dto: MongoMeetIdDto) {
        dto.myUser = req.user;
        return resOK(await this.callService.rejectCall(dto))
    }

    ///DEPRECATED
    @Post('/end/:meetId')
    async endCall(@Req() req: any, @Param() dto: MongoMeetIdDto) {
        dto.myUser = req.user;
        return resOK(await this.callService.endCall(dto))
    }

    @Post('/end/v2/:meetId')
    async endCallV2(@Req() req: any, @Param() dto: MongoMeetIdDto) {
        dto.myUser = req.user;
        return resOK(await this.callService.endCallV2(dto))
    }

    @Get("/history")
    async getCallsHistory(@Req() req: any) {
        return resOK(await this.callService.getCallsHistory(req.user));
    }

    @Delete("/history/clear")
    async deleteAllHistory(@Req() req: any) {
        return resOK(await this.callService.deleteAllHistory(req.user));
    }

    @Delete("/history/clear/:id")
    async deleteOneHistory(@Req() req: any, @Param() dto: MongoIdDto) {
        dto.myUser = req.user
        return resOK(await this.callService.deleteOneHistory(dto));
    }
}
