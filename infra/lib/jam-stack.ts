import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

interface JamStackProps extends cdk.StackProps {
  stage: string;
}

export class JamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: JamStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // ─── COGNITO ────────────────────────────────────────────────────────────

    const userPool = new cognito.UserPool(this, 'JamUserPool', {
      userPoolName: `jam-user-pool-${stage}`,
      selfSignUpEnabled: false,
      signInAliases: { username: true },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: stage === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'JamUserPoolClient', {
      userPool,
      userPoolClientName: `jam-client-${stage}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    // Grupos de acceso
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'admin',
      description: 'Administradores JAM Construcciones',
    });

    new cognito.CfnUserPoolGroup(this, 'InmobiliariaGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'inmobiliaria',
      description: 'Usuarios de inmobiliarias',
    });

    // ─── DYNAMODB ───────────────────────────────────────────────────────────

    const usuariosTable = new dynamodb.Table(this, 'JamUsuariosTable', {
      tableName: `jam-usuarios-${stage}`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: stage === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // GSI: listar usuarios por inmobiliaria
    usuariosTable.addGlobalSecondaryIndex({
      indexName: 'gsi-por-inmobiliaria',
      partitionKey: { name: 'inmobiliaria_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
    });

    // ─── LAMBDA jam-auth ────────────────────────────────────────────────────

    const authLambda = new lambda.Function(this, 'JamAuthLambda', {
      functionName: `jam-auth-${stage}`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-auth')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: stage,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        USUARIOS_TABLE: usuariosTable.tableName,
      },
    });

    // Permisos mínimos para la lambda
    usuariosTable.grantReadWriteData(authLambda);
    authLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:InitiateAuth',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminListGroupsForUser',
      ],
      resources: [userPool.userPoolArn],
    }));

    // ─── API GATEWAY ────────────────────────────────────────────────────────

    const api = new apigateway.RestApi(this, 'JamApi', {
      restApiName: `jam-api-${stage}`,
      deployOptions: { stageName: stage },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this, 'JamCognitoAuthorizer', {
        cognitoUserPools: [userPool],
        authorizerName: `jam-authorizer-${stage}`,
      }
    );

    const authLambdaIntegration = new apigateway.LambdaIntegration(authLambda);

    // POST /auth/login  → público
    const authResource = api.root.addResource('auth');
    authResource.addResource('login').addMethod('POST', authLambdaIntegration);

    // GET /auth/me → protegido
    authResource.addResource('me').addMethod('GET', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // ─── S3 + CLOUDFRONT (Frontend) ─────────────────────────────────────────

    const frontendBucket = new s3.Bucket(this, 'JamFrontendBucket', {
      bucketName: `jam-frontend-${stage}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: stage === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
    });

    const distribution = new cloudfront.Distribution(this, 'JamDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // ─── OUTPUTS ────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'CloudFrontUrl', { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'FrontendBucketName', { value: frontendBucket.bucketName });
  }
}
