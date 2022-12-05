#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EmrStudioStack } from '../lib/emr-studio-stack';

const app = new cdk.App();
new EmrStudioStack(app, 'EmrStudioStack', {
    env: { 
        account: process.env.CDK_DEFAULT_ACCOUNT, 
        region: process.env.CDK_DEFAULT_REGION 
    }
});