import { Module } from '@nestjs/common';
import { FirstRunService } from './first_run.service';
import {UserModule} from "../../../api/user_modules/user/user.module";
import {AppConfigModule} from "../../../api/app_config/app_config.module";
import {CountriesModule} from "../../../api/countries/countries.module";
import {VersionsModule} from "../../../api/versions/versions.module";
import {MeetModule} from "../../../chat/call_modules/meet/meet.module";

@Module({

  providers: [FirstRunService],
  imports: [
      UserModule,
      AppConfigModule,
      CountriesModule,
      VersionsModule,
      MeetModule
  ],
})
export class FirstRunModule {
}
