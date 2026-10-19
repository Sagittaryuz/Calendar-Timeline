package com.sagittaryuz.calendartimeline;

import android.app.job.*;
import android.content.*;

public final class RefreshJob extends JobService {
  private static final int PERIODIC = 201, IMMEDIATE = 202;

  static void schedule(Context c, boolean immediate) {
    JobScheduler jobs = (JobScheduler) c.getSystemService(JOB_SCHEDULER_SERVICE);
    ComponentName service = new ComponentName(c, RefreshJob.class);
    jobs.schedule(
        new JobInfo.Builder(PERIODIC, service)
            .setPeriodic(15 * 60 * 1000L)
            .setPersisted(true)
            .build());
    if (immediate)
      jobs.schedule(
          new JobInfo.Builder(IMMEDIATE, service)
              .setMinimumLatency(0)
              .setOverrideDeadline(1000)
              .build());
  }

  static void cancel(Context c) {
    JobScheduler jobs = (JobScheduler) c.getSystemService(JOB_SCHEDULER_SERVICE);
    jobs.cancel(PERIODIC);
    jobs.cancel(IMMEDIATE);
  }

  @Override
  public boolean onStartJob(JobParameters params) {
    RefreshCoordinator.refresh(this, (image, status) -> jobFinished(params, false));
    return true;
  }

  @Override
  public boolean onStopJob(JobParameters params) {
    return true;
  }
}
