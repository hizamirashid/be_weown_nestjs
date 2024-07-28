/**
 * Copyright 2023, the hatemragab project author.
 * All rights reserved. Use of this source code is governed by a
 * MIT license that can be found in the LICENSE file.
 */

import {Inject, Injectable} from "@nestjs/common";
import {OnEvent} from "@nestjs/event-emitter";
import * as OneSignal from "onesignal-node";
import {ConfigService} from "@nestjs/config";
import {CreateNotificationBody} from "onesignal-node/lib/types";
import {getMessaging, Messaging} from "firebase-admin/messaging";
import {UserService} from "../../api/user_modules/user/user.service";
import {UserDeviceService} from "../../api/user_modules/user_device/user_device.service";
import {PushTopics} from "../../core/utils/enums";

//
export class NotificationData {



    tokens: string[];
    title: string;
    body: string;
    tag: string;
    data: {};
    sound?: string
}

const fcmErrorCodes = [
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered",
    "messaging/invalid-argument"
];


@Injectable()
export class NotificationEvent {
    readonly messaging?: Messaging;
    readonly onesignalClient?: OneSignal.Client;

    isFirebaseFcmEnabled: boolean;
    isOneSignalEnabled: boolean;

    constructor(
        private readonly userService: UserService,
        private readonly userDevice: UserDeviceService,
        private readonly config: ConfigService
    ) {
        this.isFirebaseFcmEnabled = config.getOrThrow("isFirebaseFcmEnabled") == "true";
        this.isOneSignalEnabled = config.getOrThrow("isOneSignalEnabled") == "true";

        if (this.isFirebaseFcmEnabled) {
            this.messaging = getMessaging();
        }
        if (this.isOneSignalEnabled) {
            this.onesignalClient = new OneSignal.Client(
                this.config.getOrThrow("oneSignalAppId"),
                this.config.getOrThrow("oneSignalApiKey")
            );
        }
    }


    @OnEvent("topic.onesignal")
    async onesignalTopic(event: object) {
        let token = event["token"];
        let topic = event["topic"];
        if (!this.onesignalClient) {
            return;
        }
        await this.onesignalClient.editDevice(token, {"tags": {[topic]: true}});
    }

    @OnEvent("topic.fcm")
    async fcmTopic(event: any) {
        let token = event["token"];
        let topic = event["topic"];
        if (this.messaging) {
            await this.messaging.subscribeToTopic(token, topic);
        }
    }

    @OnEvent("un.sub")
    async unsubscribeFCM(event: any) {
        let token = event["token"];
        let topic = event["topic"];
        if (this.messaging) {
            await this.messaging.unsubscribeFromTopic(token, topic);
        }
    }


    @OnEvent("send.all.active")
    async sendToAllActiveUsers(title: string, body: string) {
        if (this.isFirebaseFcmEnabled) {
            try {
                await this.messaging.sendToTopic(PushTopics.AdminAndroid, {
                    notification: {
                        body,
                        title
                    }
                }, {
                    contentAvailable: true,
                    priority: "high",

                });
                await this.messaging.sendToTopic(PushTopics.AdminIos, {
                    notification: {
                        body,
                        title
                    }
                }, {
                    contentAvailable: true,
                    priority: "high",
                });
            } catch (err) {
                console.log(err);
            }
        }
        if (this.isOneSignalEnabled) {
            const notification: CreateNotificationBody = {
                "included_segments": [
                    "Active Users",
                    "Subscribed Users"
                ],
                "priority": 10,
                headings: {"en": title},
                "contents": {
                    "en": body
                }
            };
            this.onesignalClient.createNotification(notification)
                .then(response => {
                    //console.log(response)
                })
                .catch(e => {
                    console.log(e);
                });
        }
    }

    @OnEvent("send.onesignal")
    async sendToOneSignal(event: NotificationData) {
        if (event.tokens.length == 0) {
            return;
        }
        if (event.body.length > 1000) {
            event.body = event.body.slice(0, 1000);
        }
        if (event.data.toString().length >= 4000) {
            delete event.data["vMessage"];
        }
        try {
            for (let i = 0; i < event.tokens.length; i += 2000) {
                const listOf1000Tokens = event.tokens.slice(i, i + 2000);
                // using await to wait for sending to 1000 token
                await this._oneSignalPush(event, listOf1000Tokens);
            }
        } catch (e) {
            console.log(e);
        }

    }

    @OnEvent("send.fcm")
    async sendToFcm(event: NotificationData) {
        if (event.tokens.length == 0) {
            return;
        }
        if (event.body.length > 1000) {
            event.body = event.body.slice(0, 1000);
        }
        if (event.data.toString().length >= 4000) {
            delete event.data["vMessage"];
        }
        try {
            if (this.isFirebaseFcmEnabled) {
                for (let i = 0; i < event.tokens.length; i += 1000) {
                    const listOf1000Tokens = event.tokens.slice(i, i + 1000);
                    // using await to wait for sending to 1000 token
                    await this._fcmSend(event, listOf1000Tokens);
                }
            }
        } catch (e) {
            console.log(e);
        }
    }


    private async _fcmSend(event: NotificationData, tokens: any[]) {
        this.messaging
            .sendEachForMulticast({
                notification: {
                    body: event.body,
                    title: event.title
                },
                tokens: tokens,
                data: event.data,
                android: {
                    notification: {
                        tag: Math.random().toString(),
                        icon: "@mipmap/ic_launcher",
                        priority: "max",
                        defaultSound: true,
                        channelId: event.tag
                    },
                    priority: "high"
                    // collapseKey: event.tag,
                },
                apns: {
                    payload: {
                        aps: {
                            contentAvailable: true,
                            // mutableContent:true
                        },
                    },
                    headers: {
                        "apns-priority": "10"
                    }
                }
            })
            .then(async (reason) => {
                await this._afterFcmSendMsg(reason, event);
            })
            .catch((reason) => {
                console.log(reason);
            });
    }


    private async _oneSignalPush(event: NotificationData, tokens: any[]) {
        const notification: CreateNotificationBody = {
            "included_segments": [
                "include_player_ids"
            ],
            "priority": 10,
            "include_player_ids": tokens,
            headings: {"en": event.title},
            "contents": {
                "en": event.body
            },
            "content_available": true,
            data: event.data

        };
        this.onesignalClient.createNotification(notification)
            .then(response => {
                //console.log(response)
            })
            .catch(e => {
                console.log(e);
            });
    }

    private async _afterFcmSendMsg(reason, event) {
        let tokensToDelete = [];
        for (let x = 0; x < reason.responses.length; x++) {
            if (!reason.responses[x].success) {
                // console.log(reason.responses[x]);
                let err = reason.responses[x]["error"]["code"];
                let errInfo = reason.responses[x]["error"]["errorInfo"]["code"];
                if (fcmErrorCodes.includes(err) || fcmErrorCodes.includes(errInfo)) {
                    //  console.log("Fcm Token is" + err);
                    let token = event.tokens[x];
                    tokensToDelete.push(token);
                }
                //  console.log(token);
            }
        }
        if (tokensToDelete.length != 0) {
            console.log("start delete tokens " + tokensToDelete);
            await this.userDevice.deleteFcmTokens(tokensToDelete);
        }
    }


}
