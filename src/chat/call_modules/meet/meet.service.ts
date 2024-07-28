/**
 * Copyright 2023, the hatemragab project author.
 * All rights reserved. Use of this source code is governed by a
 * MIT license that can be found in the LICENSE file.
 */

import {Injectable, NotFoundException} from '@nestjs/common';
import {InjectModel} from "@nestjs/mongoose";
import {FilterQuery, PaginateModel, QueryOptions, UpdateQuery} from "mongoose";
import {IMeet} from "./meet.entity";
import {BaseService} from "../../../core/common/base.service";

@Injectable()
export class MeetService extends BaseService<IMeet> {
    constructor(
        @InjectModel("meet") private readonly model: PaginateModel<IMeet>,
    ) {
        super()
    }




    create(obj: Partial<IMeet>, session?): Promise<any> {
        return Promise.resolve(this.model.create([obj], {session}));
    }

    deleteMany(filter?: FilterQuery<IMeet>): Promise<any> {
        return Promise.resolve(this.model.deleteMany(filter));
    }

    findAll(filter?: FilterQuery<IMeet> | undefined, select?: string | null | undefined, options?: QueryOptions<IMeet> | null | undefined) {
        return Promise.resolve(this.model.find(filter, select, options));
    }

    findById(id: string, select?: string | null | undefined): Promise<IMeet | null> {
        return Promise.resolve(this.model.findById(id, select));
    }

    findByIdAndDelete(id: string): Promise<any> {
        return Promise.resolve(this.model.findByIdAndRemove(id));
    }

    findByIdAndUpdate(id: string, update: any  ): Promise<any> {
        return Promise.resolve(this.model.findByIdAndUpdate(id, update));
    }
    updateMany(filter: FilterQuery<IMeet>, update:any , options?: QueryOptions<IMeet> | null | undefined): Promise<any> {
        return Promise.resolve(this.model.updateMany(filter,update,options));
    }
    async findByIdOrThrow(id: string, select?: string | null | undefined): Promise<IMeet> {
        let m = await this.findById(id, select,)
        if (!m) throw new NotFoundException("group setting with id " + id + " not found in db")
        return m;
    }

    findByRoomId(roomId: string, select?: string | null | undefined, options?: QueryOptions<IMeet> | null | undefined) {
        return Promise.resolve(this.findAll({rId: roomId}, select, options));
    }

    findByRoomIdAndDelete(roomId: string,  ): Promise<any> {
        return Promise.resolve(this.model.findOneAndDelete({rId: roomId}));
    }

    findByRoomIdAndUpdate(roomId: string, update: Partial<IMeet>): Promise<any> {
        return Promise.resolve(this.updateMany({
            rId: roomId
        }, update));
    }

    findOne(filter: FilterQuery<IMeet>, select?: string | null | undefined): Promise<IMeet | null> {
        return Promise.resolve(this.model.findOne(filter, select));
    }

    createMany(obj: Array<Partial<IMeet>>, session): Promise<any> {
        return Promise.resolve(this.model.create(obj, {session}));
    }

    findOneAndUpdate(filter: FilterQuery<IMeet>, update: Partial<IMeet>, session?, options?: QueryOptions<IMeet> | null | undefined): Promise<IMeet | null> {
        return Promise.resolve(this.model.findOneAndUpdate(filter, update, options).session(session));
    }
    async findCount(filter?: FilterQuery<IMeet>,) {
        return this.model.countDocuments(filter)
    }
}
