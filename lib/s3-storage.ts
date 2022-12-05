import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface WorkspaceBucketProps {
  readonly bucketName?: string;
  readonly removalPolicy?: cdk.RemovalPolicy;
}

export class WorkspaceBucket extends Construct {
  public readonly bucketEntity: s3.Bucket;
  constructor(scope: Construct, name: string, props?: WorkspaceBucketProps) {
    super(scope, name);

    const removalPolicy = (props !== undefined) ? props.removalPolicy : cdk.RemovalPolicy.DESTROY;
    const bucketName = (props !== undefined) ? props.bucketName : `emr-studio-workspace-bucket-${cdk.Aws.ACCOUNT_ID}`;
    
    this.bucketEntity = new s3.Bucket(this, 'WorkspaceBucket', {
      bucketName: bucketName,
      removalPolicy: removalPolicy,
      autoDeleteObjects: (removalPolicy !== cdk.RemovalPolicy.RETAIN) ? true : false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });
    new cdk.CfnOutput(this, 'OWorkspaceBucket', { value: this.bucketEntity.bucketArn, description: 'The ARN of the workspace bucket.' });
  }
}

export interface EmrServerlessBucketProps {
  readonly bucketName?: string;
  readonly removalPolicy?: cdk.RemovalPolicy;
}

export class EmrServerlessBucket extends Construct {
  public readonly bucketEntity: s3.Bucket;
  constructor(scope: Construct, name: string, props?: EmrServerlessBucketProps) {
    super(scope, name);
    const removalPolicy = (props !== undefined) ? props.removalPolicy : cdk.RemovalPolicy.DESTROY;
    if (props !== undefined) {
      if (props!.removalPolicy == undefined) {
        console.log('`removalPolicy` is not set for the EMR Serverless bucket, therefore, the default removal policy, DESTROY, is set.');
      }
    }
    const bucketName = (props !== undefined) ? props.bucketName : `emr-serverless-${cdk.Aws.ACCOUNT_ID}`;
    this.bucketEntity = new s3.Bucket(this, 'Bucket', {
      bucketName: bucketName,
      removalPolicy: removalPolicy,
      autoDeleteObjects: (removalPolicy !== cdk.RemovalPolicy.RETAIN) ? true : false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });
    new cdk.CfnOutput(this, 'OEmrServerlessBucket', { value: this.bucketEntity.bucketArn, description: 'The ARN of the EMR Serverless bucket.' });
  }
}