/**
 * Copyright 2023, the hatemragab project author.
 * All rights reserved. Use of this source code is governed by a
 * MIT license that can be found in the LICENSE file.
 */

import {Module} from '@nestjs/common';
import {MeetService} from './meet.service';
import {MongooseModule} from "@nestjs/mongoose";
import {MeetSchema} from "./meet.entity";

@Module({
    providers: [MeetService],
    exports: [MeetService],
    imports: [
        MongooseModule.forFeature([{
            name: "meet",
            schema: MeetSchema
        }]),
    ]
})
export class MeetModule {
}
