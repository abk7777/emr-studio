import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EmrStudioWorkspace } from './emr-studio-workspace';

export class EmrStudioStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new EmrStudioWorkspace(this, 'EmrStudioWorkspace');

  }
}
