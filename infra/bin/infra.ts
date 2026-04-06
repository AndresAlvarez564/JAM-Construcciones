#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { JamStack } from '../lib/jam-stack';

const app = new cdk.App();

const stage = app.node.tryGetContext('stage') || 'dev';

new JamStack(app, `JamConstrucciones-${stage}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
