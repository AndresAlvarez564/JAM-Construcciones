import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import * as path from 'path';

export class JamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── COGNITO ────────────────────────────────────────────────────────────

    const userPool = new cognito.UserPool(this, 'JamUserPool', {
      userPoolName: 'jam-user-pool',
      selfSignUpEnabled: false,
      signInAliases: { username: true },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { otp: true, sms: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'JamUserPoolClient', {
      userPool,
      userPoolClientName: 'jam-client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'admin',
      description: 'Administradores JAM Construcciones',
    });

    new cognito.CfnUserPoolGroup(this, 'CoordinadorGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'coordinador',
      description: 'Coordinadores JAM Construcciones',
    });

    new cognito.CfnUserPoolGroup(this, 'SupervisorGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'supervisor',
      description: 'Supervisores JAM Construcciones',
    });

    new cognito.CfnUserPoolGroup(this, 'InmobiliariaGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'inmobiliaria',
      description: 'Usuarios de inmobiliarias',
    });

    // ─── DYNAMODB ───────────────────────────────────────────────────────────

    const usuariosTable = new dynamodb.Table(this, 'JamUsuariosTable', {
      tableName: 'jam-usuarios',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    usuariosTable.addGlobalSecondaryIndex({
      indexName: 'gsi-tipo',
      partitionKey: { name: 'tipo', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'creado_en', type: dynamodb.AttributeType.STRING },
    });

    usuariosTable.addGlobalSecondaryIndex({
      indexName: 'gsi-por-inmobiliaria',
      partitionKey: { name: 'inmobiliaria_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
    });

    const inventarioTable = new dynamodb.Table(this, 'JamInventarioTable', {
      tableName: 'jam-inventario',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    inventarioTable.addGlobalSecondaryIndex({
      indexName: 'gsi-tipo',
      partitionKey: { name: 'tipo', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'creado_en', type: dynamodb.AttributeType.STRING },
    });

    inventarioTable.addGlobalSecondaryIndex({
      indexName: 'gsi-estado',
      partitionKey: { name: 'estado', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'fecha_bloqueo', type: dynamodb.AttributeType.STRING },
    });

    inventarioTable.addGlobalSecondaryIndex({
      indexName: 'gsi-torre',
      partitionKey: { name: 'torre_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    inventarioTable.addGlobalSecondaryIndex({
      indexName: 'gsi-inmobiliaria',
      partitionKey: { name: 'bloqueado_por', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    // ─── LAMBDA jam-auth ────────────────────────────────────────────────────

    const authLambda = new lambda.Function(this, 'JamAuthLambda', {
      functionName: 'jam-auth',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-auth')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        USUARIOS_TABLE: usuariosTable.tableName,
      },
    });

    usuariosTable.grantReadWriteData(authLambda);
    authLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:InitiateAuth',
        'cognito-idp:RespondToAuthChallenge',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminListGroupsForUser',
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminEnableUser',
        'cognito-idp:AdminDisableUser',
        'cognito-idp:AdminDeleteUser',
        'cognito-idp:AdminRemoveUserFromGroup',
        'cognito-idp:AdminSetUserMFAPreference',
        'cognito-idp:AssociateSoftwareToken',
        'cognito-idp:VerifySoftwareToken',
        'cognito-idp:SetUserMFAPreference',
      ],
      resources: [userPool.userPoolArn],
    }));

    // ─── LAMBDA jam-proyectos ────────────────────────────────────────────────

    const proyectosLambda = new lambda.Function(this, 'JamProyectosLambda', {
      functionName: 'jam-proyectos',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-proyectos')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        INVENTARIO_TABLE: inventarioTable.tableName,
        USUARIOS_TABLE: usuariosTable.tableName,
      },
    });

    inventarioTable.grantReadWriteData(proyectosLambda);
    usuariosTable.grantReadData(proyectosLambda);

    // ─── DYNAMODB jam-historial-bloqueos ─────────────────────────────────────

    const historialTable = new dynamodb.Table(this, 'JamHistorialBloqueosTable', {
      tableName: 'jam-historial-bloqueos',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── SQS jam-notificaciones-queue ────────────────────────────────────────

    const notificacionesQueue = new sqs.Queue(this, 'JamNotificacionesQueue', {
      queueName: 'jam-notificaciones-queue',
      retentionPeriod: cdk.Duration.days(7),
      visibilityTimeout: cdk.Duration.seconds(60),
    });

    // ─── IAM Role para EventBridge Scheduler ─────────────────────────────────

    const schedulerRole = new iam.Role(this, 'JamSchedulerRole', {
      roleName: 'jam-scheduler-role',
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });

    // ─── LAMBDA jam-bloqueos ─────────────────────────────────────────────────

    // Construir el ARN manualmente para evitar dependencia circular
    const bloqueosLambdaArn = `arn:aws:lambda:${this.region}:${this.account}:function:jam-bloqueos`;

    const bloqueosLambda = new lambda.Function(this, 'JamBloqueosLambda', {
      functionName: 'jam-bloqueos',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-bloqueos')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        INVENTARIO_TABLE: inventarioTable.tableName,
        HISTORIAL_TABLE: historialTable.tableName,
        SQS_URL: notificacionesQueue.queueUrl,
        SCHEDULER_ROLE_ARN: schedulerRole.roleArn,
        BLOQUEOS_LAMBDA_ARN: bloqueosLambdaArn,
      },
    });

    inventarioTable.grantReadWriteData(bloqueosLambda);
    historialTable.grantReadWriteData(bloqueosLambda);
    notificacionesQueue.grantSendMessages(bloqueosLambda);

    bloqueosLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['scheduler:CreateSchedule', 'scheduler:DeleteSchedule'],
      resources: ['*'],
    }));

    schedulerRole.addToPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [bloqueosLambdaArn],
    }));

    // ─── API GATEWAY ────────────────────────────────────────────────────────

    const api = new apigateway.RestApi(this, 'JamApi', {
      restApiName: 'jam-api',
      deployOptions: { stageName: 'api' },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this, 'JamCognitoAuthorizer', {
        cognitoUserPools: [userPool],
        authorizerName: 'jam-authorizer',
      }
    );

    const authLambdaIntegration = new apigateway.LambdaIntegration(authLambda);
    const proyectosLambdaIntegration = new apigateway.LambdaIntegration(proyectosLambda);
    const bloqueosLambdaIntegration = new apigateway.LambdaIntegration(bloqueosLambda);

    // /auth
    const authResource = api.root.addResource('auth');
    authResource.addResource('login').addMethod('POST', authLambdaIntegration);
    authResource.addResource('confirm-mfa').addMethod('POST', authLambdaIntegration);
    authResource.addResource('me').addMethod('GET', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const mfaResource = authResource.addResource('mfa');
    mfaResource.addResource('setup').addMethod('POST', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    mfaResource.addResource('verify').addMethod('POST', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /proyectos
    const proyectosResource = api.root.addResource('proyectos');
    proyectosResource.addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const proyectoResource = proyectosResource.addResource('{proyecto_id}');
    proyectoResource.addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const etapasPublicResource = proyectoResource.addResource('etapas');
    etapasPublicResource.addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const torresPublicResource = proyectoResource.addResource('torres');
    torresPublicResource.addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const unidadesResource = proyectoResource.addResource('unidades');
    unidadesResource.addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const unidadResource = unidadesResource.addResource('{unidad_id}');
    unidadResource.addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    unidadResource.addResource('estado').addMethod('PUT', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin
    const adminResource = api.root.addResource('admin');

    // /admin/sistema/usuarios
    const adminSistemaResource = adminResource.addResource('sistema');
    const adminSistemaUsuariosResource = adminSistemaResource.addResource('usuarios');
    adminSistemaUsuariosResource.addMethod('GET', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminSistemaUsuariosResource.addMethod('POST', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const adminSistemaUsuarioResource = adminSistemaUsuariosResource.addResource('{usuario_id}');
    adminSistemaUsuarioResource.addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminSistemaUsuarioResource.addResource('deshabilitar').addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminSistemaUsuarioResource.addResource('habilitar').addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminSistemaUsuarioResource.addMethod('DELETE', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/inmobiliarias
    const adminInmobiliariasResource = adminResource.addResource('inmobiliarias');
    adminInmobiliariasResource.addMethod('GET', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminInmobiliariasResource.addMethod('POST', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const adminInmoResource = adminInmobiliariasResource.addResource('{inmo_id}');
    adminInmoResource.addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminInmoResource.addMethod('DELETE', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminInmoResource.addResource('deshabilitar').addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminInmoResource.addResource('habilitar').addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const adminInmoUsuariosResource = adminInmoResource.addResource('usuarios');
    adminInmoUsuariosResource.addMethod('GET', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminInmoUsuariosResource.addMethod('POST', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const adminUsuarioResource = adminInmoUsuariosResource.addResource('{usuario_id}');
    adminUsuarioResource.addMethod('DELETE', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminUsuarioResource.addResource('deshabilitar').addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminUsuarioResource.addResource('habilitar').addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /bloqueos
    const bloqueosResource = api.root.addResource('bloqueos');
    bloqueosResource.addMethod('POST', bloqueosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    bloqueosResource.addResource('activos').addMethod('GET', bloqueosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/bloqueos
    const adminBloqueosResource = adminResource.addResource('bloqueos');
    const adminBloqueoResource = adminBloqueosResource.addResource('{unidad_id}');
    adminBloqueoResource.addMethod('DELETE', bloqueosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminBloqueoResource.addResource('extender').addMethod('PUT', bloqueosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/proyectos
    const adminProyectosResource = adminResource.addResource('proyectos');
    adminProyectosResource.addMethod('POST', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const adminProyectoResource = adminProyectosResource.addResource('{proyecto_id}');
    adminProyectoResource.addMethod('PUT', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminProyectoResource.addMethod('DELETE', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/proyectos/{id}/imagen (presigned URL para subir imagen)
    adminProyectoResource.addResource('imagen').addMethod('POST', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/proyectos/{id}/etapas
    const adminEtapasResource = adminProyectoResource.addResource('etapas');
    adminEtapasResource.addMethod('POST', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const adminEtapaResource = adminEtapasResource.addResource('{etapa_id}');
    adminEtapaResource.addMethod('PUT', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminEtapaResource.addMethod('DELETE', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/proyectos/{id}/torres
    const adminTorresResource = adminProyectoResource.addResource('torres');
    adminTorresResource.addMethod('POST', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const adminTorreResource = adminTorresResource.addResource('{torre_id}');
    adminTorreResource.addMethod('PUT', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminTorreResource.addMethod('DELETE', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/proyectos/{id}/unidades
    const adminUnidadesResource = adminProyectoResource.addResource('unidades');
    adminUnidadesResource.addMethod('POST', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const adminUnidadResource = adminUnidadesResource.addResource('{unidad_id}');
    adminUnidadResource.addMethod('PUT', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminUnidadResource.addMethod('DELETE', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // CORS en respuestas de error del Gateway (401, 403, 5xx)
    api.addGatewayResponse('GatewayResponseDefault4XX', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      },
    });
    api.addGatewayResponse('GatewayResponseDefault5XX', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      },
    });

    // ─── S3 + CLOUDFRONT ────────────────────────────────────────────────────

    const frontendBucket = new s3.Bucket(this, 'JamFrontendBucket', {
      bucketName: `jam-frontend-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Bucket para assets (imágenes de proyectos, etc.)
    const assetsBucket = new s3.Bucket(this, 'JamAssetsBucket', {
      bucketName: `jam-assets-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [{
        allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        maxAge: 3000,
      }],
    });

    const oac = new cloudfront.S3OriginAccessControl(this, 'JamOAC', {
      signing: cloudfront.Signing.SIGV4_NO_OVERRIDE,
    });

    const distribution = new cloudfront.Distribution(this, 'JamDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/assets/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(assetsBucket, { originAccessControl: oac }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // Permisos: proyectosLambda puede generar presigned URLs y escribir en assets
    assetsBucket.grantReadWrite(proyectosLambda);
    proyectosLambda.addEnvironment('ASSETS_BUCKET', assetsBucket.bucketName);
    proyectosLambda.addEnvironment('CLOUDFRONT_URL', `https://${distribution.distributionDomainName}`);

    // ─── OUTPUTS ────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'CloudFrontUrl', { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'FrontendBucketName', { value: frontendBucket.bucketName });
    new cdk.CfnOutput(this, 'AssetsBucketName', { value: assetsBucket.bucketName });
  }
}
