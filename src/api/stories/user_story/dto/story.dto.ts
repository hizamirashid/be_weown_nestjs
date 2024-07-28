/**
 * Copyright 2023, the hatemragab project author.
 * All rights reserved. Use of this source code is governed by a
 * MIT license that can be found in the LICENSE file.
 */
import {Allow, IsEnum, IsJSON, IsNotEmpty, ValidateIf} from "class-validator";
import {MessageType, StoryFontType, StoryType} from "../../../../core/utils/enums";
import CommonDto from "../../../../core/common/dto/common.dto";
import {IStory} from "../../story/entities/story.entity";
import * as Buffer from "buffer";

export class CreateStoryDto extends CommonDto {

    @IsEnum(StoryType)
    storyType: StoryType


    @IsNotEmpty()
    content: string

    @Allow()
    @ValidateIf(attachmentValidationStory)
    @IsJSON()
    attachment?: string

    att?: object

    @Allow()
    backgroundColor?: string

    @Allow()
    caption?: string

    @IsEnum(StoryFontType)
    @ValidateIf(object => object["storyType"] == StoryType.Text)
    fontType?: StoryFontType

    _mediaFile?: any

    toJson() {
        console.log(this.myUser._id)
        return <Partial<IStory>>{
            storyType: this.storyType,
            caption: this.caption,
            backgroundColor: this.backgroundColor,
            att: this.att,
            userId: this.myUser._id,
            fontType: this.fontType,
            content: this.content,
            views: [],
            expireAt: this.getExpireAt(),
        }
    }

    private getExpireAt() {
        let currentDate = new Date();
        return new Date(currentDate.getTime() + 24 * 60 * 60 * 1000); // Adds 24 hours to the current date
    }

    isImage() {
        if (this.storyType == StoryType.Image) {
            return true
        }
    }

    isVideo() {
        if (this.storyType == StoryType.Video) {
            return true
        }
    }

    isText() {
        if (this.storyType == StoryType.Text) {
            return true
        }
    }

    isVoice() {
        if (this.storyType == StoryType.Voice) {
            return true
        }
    }

}

function attachmentValidationStory(object) {
    let mT = object["storyType"] as String
    return mT != StoryType.Text
}