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
        return CallSiteInjector(mv)
    }

    class CallSiteInjector(mv: MethodVisitor) : MethodVisitor(Opcodes.ASM9, mv) {
        override fun visitMethodInsn(
            opcode: Int,
            owner: String?,
            name: String?,
            descriptor: String?,
            isInterface: Boolean
        ) {
            // Debug: print candidates
            if (name == "build" && owner?.contains("OkHttpClient") == true) {
                 println("Tracer: Candidate match: owner=$owner, name=$name, desc=$descriptor")
            }

            // Check for: okhttp3/OkHttpClient$Builder.build() -> OkHttpClient
            if (opcode == Opcodes.INVOKEVIRTUAL &&
                owner == "okhttp3/OkHttpClient\$Builder" &&
                name == "build" &&
                descriptor == "()Lokhttp3/OkHttpClient;"
            ) {
                println("Tracer: Injecting interceptor into method call in $owner.$name")
                // Stack before: [Builder]
                
                // Inject: .addInterceptor(new TracerInterceptor())
                visitTypeInsn(Opcodes.NEW, "com/landoulsi/tracer/TracerInterceptor")
                visitInsn(Opcodes.DUP)
                visitMethodInsn(
                    Opcodes.INVOKESPECIAL,
                    "com/landoulsi/tracer/TracerInterceptor",
                    "<init>",
                    "()V",
                    false
                )
                // Stack: [Builder, Interceptor]
                
                visitMethodInsn(
                    Opcodes.INVOKEVIRTUAL,
                    "okhttp3/OkHttpClient\$Builder",
                    "addInterceptor",
                    "(Lokhttp3/Interceptor;)Lokhttp3/OkHttpClient\$Builder;",
                    false
                )
                // Stack: [Builder] (returned from addInterceptor)
                
                // Now call original build()
                super.visitMethodInsn(opcode, owner, name, descriptor, isInterface)
            } else {
                super.visitMethodInsn(opcode, owner, name, descriptor, isInterface)
            }
        }
    }
}
