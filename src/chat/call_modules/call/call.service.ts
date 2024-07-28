/**
 * Copyright 2023, the hatemragab project author.
 * All rights reserved. Use of this source code is governed by a
 * MIT license that can be found in the LICENSE file.
 */

import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {MeetService} from "../meet/meet.service";
import {CallStatus, MessageType, SocketEventsType} from "../../../core/utils/enums";
import {RoomMiddlewareService} from "../../room_middleware/room_middleware.service";
import {IRoomMember} from "../../room_member/entities/room_member.entity";
import {SchedulerRegistry} from "@nestjs/schedule";
import {CreateCallMemberDto} from "./dto/create-call_member.dto";
import {AcceptCallMemberDto} from "./dto/accept-call_member.dto";
import {CallMemberService} from "../call_member/call_member.service";
import {UserService} from "../../../api/user_modules/user/user.service";
import {SocketIoService} from "../../socket_io/socket_io.service";
import {UserBanService} from "../../../api/user_modules/user_ban/user_ban.service";
import {MessageService} from "../../message/message.service";
import {newMongoObjId} from "../../../core/utils/utils";
import {getMsgDtoObj} from "../../channel/chat.helper";
import {MongoMeetIdDto} from "../../../core/common/dto/mongo.meet.id.dto";
import {SendMessageDto} from "../../channel/dto/send.message.dto";
import {IUser} from "../../../api/user_modules/user/entities/user.entity";
import {AppConfigService} from "../../../api/app_config/app_config.service";
import {i18nApi} from "../../../core/utils/res.helpers";
import {CallEmitter} from "./call_emitter";
import {AgoraService} from "../../agora/agora.service";
import {MongoRoomIdDto} from "../../../core/common/dto/mongo.room.id.dto";
import {MongoIdDto} from "../../../core/common/dto/mongo.id.dto";

@Injectable()
export class CallService {
    constructor(
        private readonly userService: UserService,
        private readonly meetService: MeetService,
        private readonly socket: SocketIoService,
        private readonly userBanService: UserBanService,
        private readonly callMemberService: CallMemberService,
        private readonly middlewareService: RoomMiddlewareService,
        private schedulerRegistry: SchedulerRegistry,
        private messageService: MessageService,
        private appConfigService: AppConfigService,
        private ioService: SocketIoService,
        private readonly notificationService: CallEmitter,
        private readonly agoraService: AgoraService,
    ) {
    }

    async createCall(dto: CreateCallMemberDto) {
        const callStatuses = {
            $or: [
                {callStatus: CallStatus.Ring},
                {callStatus: CallStatus.InCall}
            ]
        };

        const [vAppConfig, rM] = await Promise.all([
            this.appConfigService.getConfig(),
            this.isThereRoomMemberAndNotBanedOrThrow(dto.roomId, dto.myUser._id)
        ]);
        if (rM.pId == null) {
            // this might be a live session
            // throw new NotFoundException("pId is null this may be not Direct room!")

            const meetId = newMongoObjId().toString();
            // let myData = await this.userService.findById(dto.myUser._id, "fullName userImage")
            // this.socket.io.to(peerId.toString()).emit(SocketEventsType.v1OnNewCall, JSON.stringify({
            //     meetId: meetId,
            //     roomId: dto.roomId,
            //     userData: myData,
            //     withVideo: dto.withVideo,
            //     payload: dto.payload,
            // }));
            return {meetId: meetId}
        }

        else { // (rM.pId != null)
            if (!vAppConfig.allowCall) throw new BadRequestException(i18nApi.callNotAllowedString)

            const [roomActiveCalls, peerActiveCalls] = await Promise.all([
                this.meetService.findAll({
                    $and: [
                        callStatuses,
                        {roomId: dto.roomId}
                    ]
                }),
                this.meetService.findAll({
                    $and: [
                        callStatuses,
                        {
                            $or: [
                                {caller: rM.pId},
                                {callee: rM.pId}
                            ]
                        }
                    ]
                })
            ]);
    
            if (roomActiveCalls.length != 0) throw new BadRequestException(i18nApi.roomAlreadyInCallString)
            if (peerActiveCalls.length != 0) throw new BadRequestException(i18nApi.peerUserInCallNowString)
    
            const meetId = newMongoObjId().toString();
    
            await this.createCallAndNotify(dto, rM.pId, meetId, vAppConfig.callTimeout);
            ///we need to create userAccess for agora!
            //  let userAccess = this.agoraService.getAgoraAccess(meetId, dto.myUser._id, true);
            return {meetId: meetId}
        }
    }

    private async createCallAndNotify(dto: CreateCallMemberDto, peerId: string, meetId: string, callTimeout: number) {
        await this.createRingMessageAndNotify(dto, meetId, peerId);
        let myData = await this.userService.findById(dto.myUser._id, "fullName userImage")
        this.socket.io.to(peerId.toString()).emit(SocketEventsType.v1OnNewCall, JSON.stringify({
            meetId: meetId,
            roomId: dto.roomId,
            userData: myData,
            withVideo: dto.withVideo,
            payload: dto.payload,
        }));

        let missedDto = getMsgDtoObj({
            rId: dto.roomId,
            mT: MessageType.Call,
            att: {
                callStatus: CallStatus.Timeout,
                startAt: new Date(),
                withVideo: dto.withVideo,
                endAt: null
            },
            content: `📞 Missed Call from  ${dto.myUser.fullName}`,
            user: dto.myUser
        });

        this.schedulerRegistry.addTimeout(
            `${meetId}_call`,
            setTimeout(
                () => this._timeoutRing(peerId, meetId, missedDto),
                callTimeout,
            ),
        );
    }

    private async createRingMessageAndNotify(dto: CreateCallMemberDto, meetId: string, peerId: string) {
        await Promise.all([
            this.meetService.create({
                _id: meetId,
                callStatus: CallStatus.Ring,
                caller: dto.myUser._id,
                callee: peerId,
                withVideo: dto.withVideo,
                meetPlatform: dto.meetPlatform,
                roomId: dto.roomId,
            }),
            this.callMemberService.create({
                meetId: meetId,
                userId: dto.myUser._id,
                roomId: dto.roomId,
                userDeviceId: dto.myUser.currentDevice._id,
            })
        ]);

        let ringMsgDto = getMsgDtoObj({
            rId: dto.roomId,
            mT: MessageType.Call,
            att: {
                callStatus: CallStatus.Ring,
                startAt: new Date(),
                withVideo: dto.withVideo,
                endAt: null
            },
            content: `📞 New call from ${dto.myUser.fullName}`,
            user: dto.myUser
        });
        await this.notificationService.ringNotify(peerId, ringMsgDto);
    }


    async getRingCall(userId: string) {
        let meet = await this.meetService.findOne({
            callee: userId,
            callStatus: {$eq: CallStatus.Ring}
        });

        if (!meet) return null;

        const [callerData, peerData] = await Promise.all([
            this.callMemberService.findOne({
                meetId: meet._id,
                userId: meet.caller
            }),
            this.userService.findById(meet.caller, "fullName userImage")
        ]);

        return {
            meetId: meet._id,
            roomId: meet.roomId,
            userData: peerData,
            withVideo: meet.withVideo,
        };
    }


    async cancelCall(dto: MongoMeetIdDto) {
        // to cancel the call you must be the caller
        let meet = await this.meetService.findByIdOrThrow(dto.meetId)
        if (meet.callStatus != CallStatus.Ring) {
            throw new BadRequestException("meet status not Ring!")
        }
        await this.isThereRoomMemberAndNotBanedOrThrow(
            meet.roomId,
            dto.myUser._id,
        );
        if (meet.caller != dto.myUser._id) {
            throw new BadRequestException("you must be the caller to be cancel")
        }
        await this.meetService.findByIdAndUpdate(meet._id, {
            callStatus: CallStatus.Canceled
        })
        this.socket.io
            .to(meet.callee.toString())
            .emit(SocketEventsType.v1OnCallCanceled, JSON.stringify({
                meetId: dto.meetId,
                roomId: meet.roomId,
            }));
        return "Call canceled"
    }

    async isThereRoomMemberAndNotBanedOrThrow(roomId: string, userId: string): Promise<IRoomMember> {
        let r = await this.middlewareService.isThereRoomMemberOrThrow(roomId, userId);
        let ban = await this.userBanService.getBan(r.pId, r.uId)
        if (ban) throw new BadRequestException("You dont have access you has been out")
        return r
    }

    async endCall(dto: MongoMeetIdDto) {
        const current = new Date();
        let meet = await this.meetService.findByIdOrThrow(dto.meetId);
        await this.isThereRoomMemberAndNotBanedOrThrow(meet.roomId, dto.myUser._id)
        if (meet.callStatus != CallStatus.InCall) {
            throw new BadRequestException("meet status not InCall!");
        }

        const socketId = (meet.caller.toString() == dto.myUser._id) ? meet.callee.toString() : meet.caller.toString();

        await Promise.all([
            this.meetService.findByIdAndUpdate(dto.meetId, {
                callStatus: CallStatus.Finished,
                endAt: current
            }),
            this.socket.io.to(meet.roomId.toString()).emit(SocketEventsType.v1OnCallEnded, JSON.stringify({
                meetId: dto.meetId,
                roomId: meet.roomId,
            }))
        ]);

        const finishedMsgDto = getMsgDtoObj({
            rId: meet.roomId,
            mT: MessageType.Call,
            att: {
                callStatus: CallStatus.Finished,
                withVideo: meet.withVideo,
                endAt: current,
                startAt: meet.createdAt,
            },
            content: `📞`,
            user: dto.myUser
        });

        const newMessage = await this.messageService.create(finishedMsgDto);

        this.socket.io.to(meet.roomId.toString()).emit(SocketEventsType.v1OnNewMessage, JSON.stringify(newMessage));

        return "End canceled";
    }


    async acceptCall(dto: AcceptCallMemberDto) {
        const meet = await this.meetService.findByIdOrThrow(dto.meetId);

        if (meet.callStatus != CallStatus.Ring) {
            throw new BadRequestException("meet status not ring!");
        }
        if (meet.callee != dto.myUser._id) throw new BadRequestException("only callee can accept this call!");

        await this.isThereRoomMemberAndNotBanedOrThrow(meet.roomId, dto.myUser._id);

        const callMemberCreation = this.callMemberService.create({
            meetId: meet._id,
            userId: dto.myUser._id,
            roomId: meet.roomId,
            userDeviceId: dto.myUser.currentDevice._id,
        });

        const meetUpdate = this.meetService.findByIdAndUpdate(dto.meetId, {
            callStatus: CallStatus.InCall
        });

        await Promise.all([callMemberCreation, meetUpdate]);

        const peerUserCallMember = await this.callMemberService.findOne({
            meetId: dto.meetId,
            userId: meet.caller
        });

        const peerSocket = await this.ioService.getSocketByDeviceId(peerUserCallMember.userDeviceId);

        if (!peerSocket) {
            await this.meetService.findByIdAndUpdate(dto.meetId, {
                callStatus: CallStatus.Timeout
            });
            throw new BadRequestException(i18nApi.peerUserDeviceOfflineString);
        }
        //let userAccess = this.agoraService.getAgoraAccess(dto.meetId, meet.caller, false);
        peerSocket.emit(SocketEventsType.v1OnCallAccepted, JSON.stringify({
            meetId: dto.meetId,
            roomId: meet.roomId,
            peerAnswer: dto.payload,
        }));

        return dto.meetId;
    }


    async rejectCall(dto: MongoMeetIdDto) {
        // to reject the call, you must be the callee
        let meet = await this.meetService.findByIdOrThrow(dto.meetId)
        if (meet.callStatus != CallStatus.Ring) {
            throw new BadRequestException("meet status not Ring!")
        }
        await this.isThereRoomMemberAndNotBanedOrThrow(
            meet.roomId,
            dto.myUser._id,
        );
        if (meet.callee != dto.myUser._id) {
            throw new BadRequestException("you must be the callee to be reject")
        }
        await this.meetService.findByIdAndUpdate(meet._id, {
            callStatus: CallStatus.Rejected
        })
        this.socket.io
            .to(meet.caller.toString())
            .emit(SocketEventsType.v1OnCallRejected, JSON.stringify({
                meetId: dto.meetId,
                roomId: meet.roomId,
            }));
        const rejectMsgDto = getMsgDtoObj({
            rId: meet.roomId,
            mT: MessageType.Call,
            att: {
                callStatus: CallStatus.Rejected,
                withVideo: meet.withVideo,
            },
            content: `📞`,
            user: dto.myUser
        });
        const newMessage = await this.messageService.create(rejectMsgDto);
        this.socket.io.to(meet.roomId.toString()).emit(SocketEventsType.v1OnNewMessage, JSON.stringify(newMessage));
        return "Call rejected"
    }

    private async _timeoutRing(peerId: string, meetId: string, missedDto: SendMessageDto) {
        const meet = await this.meetService.findById(meetId);

        if (meet.callStatus == CallStatus.Ring) {
            await this.meetService.findByIdAndUpdate(meetId, {
                callStatus: CallStatus.Timeout,
            });

            const newMessage = await this.messageService.create(missedDto);

            const socketEmissions = [
                this.socket.io.to(missedDto._roomId.toString()).emit(SocketEventsType.v1OnNewMessage, JSON.stringify(newMessage)),
                this.socket.io.to(missedDto._roomId.toString()).emit(SocketEventsType.v1OnCallTimeout, JSON.stringify({
                    meetId: meetId,
                    roomId: missedDto._roomId
                }))
            ];

            await Promise.all(socketEmissions);
            await this.notificationService.ringNotify(peerId, missedDto)
        }
    }

    async getCallsHistory(user: IUser) {
        let data: any = await this.meetService.findAll({
            $and: [
                {
                    $or: [
                        {caller: user._id},
                        {callee: user._id}
                    ],
                },
                {
                    deleteFrom: {$ne: newMongoObjId(user._id)},
                }
            ],
            callStatus: {$ne: CallStatus.SessionEnd}
        }, null, {
            limit: 30, sort: "-_id", populate: [
                {
                    path: "caller",
                    select: "fullName userImage"
                },
                {
                    path: "callee",
                    select: "fullName userImage"
                }
            ]
        });

        let result = [];
        for (let i = 0; i < data.length; i++) {
            let item = data[i];
            let peerUser = user._id === item.caller._id.toString() ? item.callee : item.caller;
            result.push({
                callStatus: item.callStatus,
                roomId: item.roomId,
                withVideo: item.withVideo,
                meetPlatform: item.meetPlatform,
                endAt: item.endAt,
                createdAt: item.createdAt,
                _id:item._id,
                peerUser,
            });
        }

        return result;
    }

    async deleteAllHistory(user: IUser) {
        await this.meetService.updateMany({
            $or: [
                {
                    caller: user._id
                },
                {
                    callee: user._id
                }
            ]
        }, {
            $addToSet: {
                deleteFrom: newMongoObjId(user._id),
            },
        })
        return "Done"
    }

    async getAgoraAccess(dto: MongoRoomIdDto) {
        await this.isThereRoomMemberAndNotBanedOrThrow(dto.roomId, dto.myUser._id)
        return this.agoraService.getAgoraAccessNew(dto.roomId, true);
    }

    async endCallV2(dto: MongoMeetIdDto) {
        let meet = await this.meetService.findByIdOrThrow(dto.meetId)
        await this.isThereRoomMemberAndNotBanedOrThrow(
            meet.roomId,
            dto.myUser._id,
        );
        let myId = dto.myUser._id.toString()
        if (meet.caller.toString() == myId) {
            //cases is cancel and end only
            if (meet.callStatus == CallStatus.Ring) {
                return this.cancelCall(dto)
            } else {
                return this.endCall(dto)
            }

        } else {
            //cases end only
            if (meet.callStatus == CallStatus.Ring) {
                return this.rejectCall(dto)
            }
            return this.endCall(dto)
        }
    }

    async deleteOneHistory(dto: MongoIdDto) {
        await this.meetService.findByIdAndUpdate(dto.id, {
            $addToSet: {
                deleteFrom: newMongoObjId(dto.myUser._id),
            },
        })
        return "Done"
    }
}
