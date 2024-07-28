/**
 * Copyright 2023, the hatemragab project author.
 * All rights reserved. Use of this source code is governed by a
 * MIT license that can be found in the LICENSE file.
 */

import mongoose, {Schema} from "mongoose";
import pM from "mongoose-paginate-v2"

export interface IMeetMember {
    _id: string
    userId: string;
    meetId: string;
    userDeviceId: string;
    roomId: string
}

export const MeetMemberSchema = new mongoose.Schema(
    {
        userId: {type: String, required: true},
        meetId: {type: String, required: true},
        userDeviceId: {type: String, required: true},
        roomId: {type: String, required: true},
    },
    {
        timestamps: true,
    }
);
MeetMemberSchema.plugin(pM)