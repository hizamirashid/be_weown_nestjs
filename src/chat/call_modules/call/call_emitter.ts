/**
 * Copyright 2023, the hatemragab project author.
 * All rights reserved. Use of this source code is governed by a
 * MIT license that can be found in the LICENSE file.
 */

import {Injectable} from "@nestjs/common";
import {NotificationEmitterService, rExp} from "../../../common/notification_emitter/notification_emitter.service";
import {UserService} from "../../../api/user_modules/user/user.service";
import {UserDeviceService} from "../../../api/user_modules/user_device/user_device.service";
import {NotificationData} from "../../../common/notification_emitter/notification.event";
import {IMessage} from "../../message/entities/message.entity";
import {NotificationType} from "../../../core/utils/enums";
import {PushKeyAndProvider} from "../../../core/utils/interfaceces";
import {SendMessageDto} from "../../channel/dto/send.message.dto";

@Injectable()
export class CallEmitter {
    constructor(
        readonly emitterService: NotificationEmitterService,
        private readonly userService: UserService,
        private readonly userDevice: UserDeviceService,
    ) {
    }


    async ringNotify(peerId: string, msg: SendMessageDto) {
        let tokens = new PushKeyAndProvider([], []);
        let devices = await this.userDevice.getUserPushTokens(peerId);
        tokens.fcm = devices.fcm
        tokens.oneSignal = devices.oneSignal

        this.emit({
            data: {
                type: NotificationType.SingleChat,
                fromVChat: "true"
            },
            tag: msg._roomId,
            body: this._parseMessageMentions(msg.content),
            title: msg.myUser.fullName,
            tokens: []
        }, tokens);
    }

    private _parseMessageMentions(body: string) {
        return body.replaceAll(rExp, substring => {
            try {
                return substring.split(":")[0].substring(1)
            } catch (e) {
                console.log("Error while _parseMessageMentions in NotificationEmitterService")
                return substring
            }

        })
    }

    private emit(notificationData: NotificationData, tokens: PushKeyAndProvider) {
        notificationData.sound = "ringtone";
        if (tokens.fcm.length != 0) {
            notificationData.tokens = tokens.fcm;
            this.emitterService.fcmSend(notificationData);
        }
        if (tokens.oneSignal.length != 0) {
            notificationData.tokens = tokens.oneSignal;
            this.emitterService.oneSignalSend(notificationData);
        }
    }
}