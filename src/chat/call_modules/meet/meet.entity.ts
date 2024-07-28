/**
 * Copyright 2023, the hatemragab project author.
 * All rights reserved. Use of this source code is governed by a
 * MIT license that can be found in the LICENSE file.
 */

import mongoose, {Schema} from "mongoose";
import pM from "mongoose-paginate-v2"
import {CallStatus, MeetPlatform} from "../../../core/utils/enums";

export interface IMeet {
    _id: string
    caller: string;
    callee: string;
    callStatus: CallStatus;
    roomId: string
    withVideo: boolean
    meetPlatform: MeetPlatform,
    deleteFrom:any[],
    endAt?: Date
    createdAt : Date
}

export const MeetSchema = new mongoose.Schema(
    {
        caller: {type: String, required: true,ref:"user"},
        callee: {type: String, required: true,ref:"user"},
        callStatus: {type: String, enum: Object.values(CallStatus), required: true,index:1},
        roomId: {type: String, required: true},
        withVideo: {type: Boolean, required: true},
        meetPlatform: {type: String, enum: Object.values(MeetPlatform), default: MeetPlatform.WebRtc},
        endAt: {type: Date, default: null},
        deleteFrom: {type: [Schema.Types.ObjectId],default: []},
    },
    {
        timestamps: true,
    }
);
MeetSchema.plugin(pM)