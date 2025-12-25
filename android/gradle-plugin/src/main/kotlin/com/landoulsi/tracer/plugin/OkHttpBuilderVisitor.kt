package com.landoulsi.tracer.plugin

import org.objectweb.asm.ClassVisitor
import org.objectweb.asm.MethodVisitor
import org.objectweb.asm.Opcodes

class OkHttpBuilderVisitor(nextVisitor: ClassVisitor) : ClassVisitor(Opcodes.ASM9, nextVisitor) {

    override fun visitMethod(
        access: Int,
        name: String?,
        descriptor: String?,
        signature: String?,
        exceptions: Array<out String>?
    ): MethodVisitor {
        val mv = super.visitMethod(access, name, descriptor, signature, exceptions)
        
        // We want to intercept the build() method of OkHttpClient.Builder.
        // build() takes no arguments and returns OkHttpClient.
        if (name == "build" && descriptor == "()Lokhttp3/OkHttpClient;") {
            return BuildMethodVisitor(mv)
        }
        return mv
    }

    class BuildMethodVisitor(mv: MethodVisitor) : MethodVisitor(Opcodes.ASM9, mv) {
        override fun visitCode() {
            super.visitCode()
            
            // Inject: this.addInterceptor(new TracerInterceptor())
            
            // 1. Load 'this' (the Builder instance) onto the stack
            mv.visitVarInsn(Opcodes.ALOAD, 0)
            
            // 2. Create new instance of TracerInterceptor
            mv.visitTypeInsn(Opcodes.NEW, "com/landoulsi/tracer/TracerInterceptor")
            mv.visitInsn(Opcodes.DUP)
            mv.visitMethodInsn(
                Opcodes.INVOKESPECIAL, 
                "com/landoulsi/tracer/TracerInterceptor", 
                "<init>", 
                "()V", 
                false
            )
            
            // 3. Call addInterceptor(Interceptor) -> returns Builder
            // Descriptor: (Lokhttp3/Interceptor;)Lokhttp3/OkHttpClient$Builder;
            mv.visitMethodInsn(
                Opcodes.INVOKEVIRTUAL,
                "okhttp3/OkHttpClient\$Builder",
                "addInterceptor",
                "(Lokhttp3/Interceptor;)Lokhttp3/OkHttpClient\$Builder;",
                false
            )
            
            // 4. Pop the returned Builder from stack because we don't use it, 
            // we just wanted the side effect of adding the interceptor.
            // The original code follows using 'this' which is already valid or loaded when needed.
            mv.visitInsn(Opcodes.POP)
            
            // Continue with original method code...
        }
    }
}
