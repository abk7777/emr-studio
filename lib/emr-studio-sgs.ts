import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface EmrStudioEngineSecurityGroupProps {
  readonly vpc: ec2.IVpc;
}

export class EmrStudioEngineSecurityGroup extends Construct {
  public readonly securityGroup: ec2.SecurityGroup;
  constructor(scope: Construct, name: string, props: EmrStudioEngineSecurityGroupProps) {
    super(scope, name);

    this.securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      securityGroupName: `DefaultEngineSecurityGroup-${cdk.Aws.ACCOUNT_ID}`,
      vpc: props.vpc,
      allowAllOutbound: false,
      disableInlineRules: true,
      description: 'Engine SG for EMR Studio',
    });

    cdk.Tags.of(this.securityGroup).add('Name', `DefaultEngineSecurityGroup-${cdk.Aws.ACCOUNT_ID}`);
    new cdk.CfnOutput(this, 'EmrEngineSecurityGroupId', { value: this.securityGroup.securityGroupId, description: 'The sg ID of the engine security group for EMR Studio' });
  }
}

export interface EmrStudioWorkspaceSecurityGroupProps {
  readonly vpc: ec2.IVpc;
}


export class EmrStudioWorkspaceSecurityGroup extends Construct {
  public readonly securityGroup: ec2.SecurityGroup;
  constructor(scope: Construct, name: string, props: EmrStudioWorkspaceSecurityGroupProps) {
    super(scope, name);

    this.securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      securityGroupName: `DefaultWorkspaceSecurityGroupGit-${cdk.Aws.ACCOUNT_ID}`,
      vpc: props.vpc,
      allowAllOutbound: false,
      disableInlineRules: true,
      description: 'Workspace SG for EMR Studio',
    });

    cdk.Tags.of(this.securityGroup).add('Name', `DefaultWorkspaceSecurityGroupGit-${cdk.Aws.ACCOUNT_ID}`);
    new cdk.CfnOutput(this, 'EmrEngineSecurityGroupId', { value: this.securityGroup.securityGroupId, description: 'The SG ID of the workspace security group for EMR Studio' });
  }
}